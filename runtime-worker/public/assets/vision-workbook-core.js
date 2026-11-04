'use strict';
/* Interpreter for the supplied workbook's audited arithmetic AST. No eval or executable workbook code. */
class VisionFormulaError {
  constructor(code, cell=''){this.code=code;this.cell=cell;}
  toString(){return this.code;}
}
const visionIsError=value=>value instanceof VisionFormulaError;
const visionFlat=value=>Array.isArray(value)?value.flat(Infinity):[value];
function visionNumber(value){
  if(visionIsError(value))return value;
  if(value===null||value===undefined)return 0;
  if(value==='')return new VisionFormulaError('#VALUE!');
  if(typeof value==='boolean')return Number(value);
  if(typeof value==='number')return Number.isFinite(value)?value:new VisionFormulaError('#NUM!');
  const text=String(value).trim();
  const number=text.endsWith('%')?Number(text.slice(0,-1))/100:Number(text);
  return Number.isFinite(number)?number:new VisionFormulaError('#VALUE!');
}
function visionText(value){
  if(value===null||value===undefined)return '';
  if(typeof value==='number')return String(Number(value.toPrecision(15)));
  if(typeof value==='boolean')return value?'TRUE':'FALSE';
  return String(value);
}
function visionEqual(a,b){
  if(a==null)a='';if(b==null)b='';
  return typeof a===typeof b?(typeof a==='string'?a.toLowerCase()===b.toLowerCase():a===b):false;
}
function visionRound(value,digits,up=false){
  value=visionNumber(value);digits=visionNumber(digits);
  if(visionIsError(value)||visionIsError(digits))return visionIsError(value)?value:digits;
  const factor=10**Math.trunc(digits),scaled=Math.abs(value)*factor;
  return Math.sign(value)*(up?Math.ceil(scaled):Math.floor(scaled+0.5))/factor;
}
class VisionWorkbook {
  constructor(data,overrides={},corrected=true){this.data=data;this.overrides=overrides;this.corrected=corrected;this.memo=new Map();this.active=new Set();}
  get(sheet,cell){
    const key=cell===undefined?sheet:sheet+'!'+cell;
    if(Object.prototype.hasOwnProperty.call(this.overrides,key))return this.overrides[key];
    if(this.memo.has(key))return this.memo.get(key);
    if(this.active.has(key))return new VisionFormulaError('#CYCLE!',key);
    this.active.add(key);
    const record=(this.corrected&&this.data.corrections[key])||this.data.cells[key];
    let value=record?(record.f?this.evaluate(record.f):record.v):null;
    if(typeof value==='number'&&!Number.isFinite(value))value=new VisionFormulaError('#NUM!',key);
    if(visionIsError(value)&&!value.cell)value=new VisionFormulaError(value.code,key);
    this.active.delete(key);this.memo.set(key,value);return value;
  }
  range(sheet,start,end){
    const point=address=>{const [,letters,row]=address.match(/^([A-Z]+)(\d+)$/);let column=0;for(const l of letters)column=column*26+l.charCodeAt(0)-64;return [column,Number(row)];};
    const columnName=n=>{let text='';while(n){n--;text=String.fromCharCode(65+n%26)+text;n=Math.floor(n/26);}return text;};
    const [x1,y1]=point(start),[x2,y2]=point(end),rows=[];
    for(let y=y1;y<=y2;y++){const row=[];for(let x=x1;x<=x2;x++)row.push(this.get(sheet,columnName(x)+y));rows.push(row);}return rows;
  }
  binary(op,a,b){
    if(Array.isArray(a)||Array.isArray(b)){
      const rows=Math.max(Array.isArray(a)?a.length:1,Array.isArray(b)?b.length:1);
      const cols=Math.max(Array.isArray(a)?a[0].length:1,Array.isArray(b)?b[0].length:1);
      return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>this.binary(op,Array.isArray(a)?a[a.length===1?0:r]?.[a[0].length===1?0:c]:a,Array.isArray(b)?b[b.length===1?0:r]?.[b[0].length===1?0:c]:b)));
    }
    if(visionIsError(a)||visionIsError(b))return visionIsError(a)?a:b;
    if(op==='&')return visionText(a)+visionText(b);
    if(['=','<>','>','<','>=','<='].includes(op)){
      if(op==='=')return visionEqual(a,b)||(a==null&&b===0)||(b==null&&a===0);
      if(op==='<>')return !this.binary('=',a,b);
      if(a==null)a=0;if(b==null)b=0;
      if(typeof a==='string'&&typeof b==='string'){a=a.toLowerCase();b=b.toLowerCase();}
      if(typeof a!==typeof b){a=typeof a==='string'?1:0;b=typeof b==='string'?1:0;}
      return op==='>'?a>b:op==='<'?a<b:op==='>='?a>=b:a<=b;
    }
    a=visionNumber(a);b=visionNumber(b);if(visionIsError(a)||visionIsError(b))return visionIsError(a)?a:b;
    if(op==='/'&&b===0)return new VisionFormulaError('#DIV/0!');
    const value=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:op==='/'?a/b:a**b;
    return Number.isFinite(value)?value:new VisionFormulaError('#NUM!');
  }
  evaluate(node){
    if(!Array.isArray(node))return node;
    const [kind,...args]=node;
    if(kind==='ref')return this.get(args[0],args[1]);
    if(kind==='range')return this.range(...args);
    if(kind==='error')return new VisionFormulaError(args[0]);
    if(kind==='binary')return this.binary(args[0],this.evaluate(args[1]),this.evaluate(args[2]));
    if(kind==='unary')return this.binary('*',args[0]==='-'?-1:1,this.evaluate(args[1]));
    if(kind!=='call')throw new Error('Unsupported workbook AST node: '+kind);
    const [name,expressions]=args;
    if(name==='IF'){
      const condition=visionNumber(this.evaluate(expressions[0]));
      return visionIsError(condition)?condition:this.evaluate(expressions[condition?1:2]??false);
    }
    if(name==='IFERROR'){
      const first=this.evaluate(expressions[0]);
      return visionIsError(first)?this.evaluate(expressions[1]):first;
    }
    const values=expressions.map(expr=>this.evaluate(expr));
    const directError=values.find(visionIsError);if(directError)return directError;
    if(name==='ROUND'||name==='ROUNDUP')return visionRound(values[0],values[1],name==='ROUNDUP');
    if(name==='MAX'){
      const list=visionFlat(values),error=list.find(visionIsError);if(error)return error;
      return Math.max(0,...list.filter(x=>typeof x==='number'));
    }
    if(name==='MOD'){const a=visionNumber(values[0]),b=visionNumber(values[1]);return b===0?new VisionFormulaError('#DIV/0!'):a-b*Math.floor(a/b);}
    if(name==='LEFT')return visionText(values[0]).slice(0,values[1]===undefined?1:Math.trunc(values[1]));
    if(name==='MID')return visionText(values[0]).slice(Math.trunc(values[1])-1,Math.trunc(values[1])-1+Math.trunc(values[2]));
    if(name==='INDEX'){
      const array=Array.isArray(values[0])?values[0]:[[values[0]]],row=Math.trunc(values[1]),col=Math.trunc(values[2]??1);
      if(row<1||col<1||row>array.length||col>array[0].length)return new VisionFormulaError('#REF!');
      return array[row-1][col-1];
    }
    if(name==='VLOOKUP'){
      const [key,table,index,approximate=true]=values,col=Math.trunc(index);
      if(!Array.isArray(table)||col<1||col>table[0].length)return new VisionFormulaError('#REF!');
      let selected=null;
      for(const row of table){
        if(visionIsError(row[0]))continue;
        if(visionEqual(key,row[0]))return row[col-1]??0;
        if(approximate&&this.binary('<=',row[0],key)===true)selected=row;
      }
      return selected?selected[col-1]??0:new VisionFormulaError('#N/A');
    }
    if(name==='COUNTIF'){
      const pool=visionFlat(values[0]);
      const count=criterion=>pool.filter(item=>{
        if(visionIsError(item))return false;
        const match=typeof criterion==='string'&&criterion.match(/^(>=|<=|<>|>|<|=)(.*)$/);
        if(match){let target=match[2];if(target!==''&&Number.isFinite(Number(target)))target=Number(target);return this.binary(match[1],item,target)===true;}
        return visionEqual(item,criterion)||(item==null&&criterion===0);
      }).length;
      return Array.isArray(values[1])?values[1].map(row=>row.map(count)):count(values[1]);
    }
    if(name==='LOOKUP'){
      const [key,vector,resultVector=vector]=values,search=visionFlat(vector),results=visionFlat(resultVector);let found=-1;
      for(let i=0;i<search.length;i++)if(!visionIsError(search[i])&&search[i]!=null&&this.binary('<=',search[i],key)===true)found=i;
      return found<0?new VisionFormulaError('#N/A'):results[found];
    }
    if(name==='LARGE'){
      const numbers=visionFlat(values[0]).filter(x=>typeof x==='number').sort((a,b)=>b-a),rank=Math.trunc(values[1]);
      return rank>=1&&rank<=numbers.length?numbers[rank-1]:new VisionFormulaError('#NUM!');
    }
    throw new Error('Unsupported workbook function: '+name);
  }
  result(sheet,addresses){return Object.fromEntries(addresses.map(a=>[a,this.get(sheet,a)]));}
}
if(typeof module!=='undefined')module.exports={VisionWorkbook,VisionFormulaError,visionIsError};
