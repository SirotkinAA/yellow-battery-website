"""Private price books. Only explicitly selected sale fields leave the portal."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import date
import re

PUBLIC_FIELDS = ('model_id', 'amount_minor', 'currency', 'basis', 'price_date')

def required_text(value, name, maximum=250):
    if not isinstance(value, str) or not value.strip() or len(value)>maximum:
        raise ValueError('Некорректное поле: '+name)
    return value.strip()

def prepare_pricebook(book, model_ids):
    if not isinstance(book, dict):raise ValueError('Ожидается прайс в JSON')
    revision=required_text(book.get('revision'),'revision',100)
    method=book.get('pricing_method')
    if method not in ('margin','markup'):raise ValueError('Выберите формулу: margin (цена / (1 − коэффициент)) или markup (цена × (1 + коэффициент))')
    try:rate=Decimal(str(book.get('rate')))
    except InvalidOperation:raise ValueError('Некорректный коэффициент')
    if not rate.is_finite() or not 0<=rate<1:raise ValueError('Коэффициент должен быть от 0 до 1, не включая 1')
    entries=book.get('entries')
    if not isinstance(entries,list) or not 1<=len(entries)<=1000:raise ValueError('Ожидается от 1 до 1000 цен')
    rows=[];seen=set()
    for item in entries:
        if not isinstance(item,dict):raise ValueError('Некорректная строка прайса')
        model=item.get('model_id')
        if not isinstance(model,str) or model not in model_ids or model in seen:raise ValueError('Неизвестная или повторная модель: '+str(model))
        seen.add(model)
        # Decimal avoids float rounding; prices are stored in cents/kopecks.
        cost=item.get('cost_minor')
        if type(cost) is not int or not 0<cost<=100_000_000:raise ValueError('Закупочная цена должна быть положительным целым числом в сотых долях валюты')
        currency=item.get('currency')
        if currency not in ('USD','EUR','RUB','CNY'):raise ValueError('Валюта: USD, EUR, RUB или CNY')
        stamp=required_text(item.get('price_date'),'price_date',10)
        if not re.fullmatch(r'\d{4}-\d{2}(-\d{2})?',stamp):raise ValueError('Дата прайса: YYYY-MM или YYYY-MM-DD')
        date.fromisoformat(stamp if len(stamp)==10 else stamp+'-01')
        value=Decimal(cost)/(1-rate) if method=='margin' else Decimal(cost)*(1+rate)
        amount=int(value.quantize(Decimal('1'),rounding=ROUND_HALF_UP))
        if amount>1_000_000_000:raise ValueError('Слишком большая итоговая цена')
        rows.append({'model_id':model,'cost_minor':cost,'amount_minor':amount,'currency':currency,
                     'basis':required_text(item.get('basis'),'basis'), 'price_date':stamp,
                     'source':required_text(item.get('source'),'source',500),
                     'source_model':required_text(item.get('source_model'),'source_model',100),
                     'source_ref':required_text(item.get('source_ref'),'source_ref',150)})
    return {'revision':revision,'pricing_method':method,'rate':str(rate),'entries':rows}

def public_prices(book):
    return [{**{key:row[key] for key in PUBLIC_FIELDS},'updated_at':book.get('updated_at')} for row in book.get('entries',[])]
