"""Runs during linux/amd64 image build; DWG includes full round-trip verification."""
from interconnect_documents.drawing import generate
raw=dict(section_mm2=70,length_m=.66,series_batteries=2,parallel_strings=1,
         lug_left='2I8',lug_right='2I8',drawing_scope='layout_group',
         drawing_quantity=3,route_length_mm=660,drawing_code='ЯЯ.ПМ.001')
for fmt,signature in [('pdf',b'%PDF-'),('dwg',b'AC1015'),('dxf',b'  0')]:
    data=generate(raw,fmt)
    assert data.startswith(signature),(fmt,data[:20])
    assert len(data)>1000
    print(fmt,'verified',len(data))
