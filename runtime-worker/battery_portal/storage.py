import json
from pathlib import Path

class SQLiteStore:
    def __init__(self, path):
        self.path = str(path)
        with self.connect() as db:
            db.executescript(Path(__file__).with_name('schema.sql').read_text())
    def connect(self):
        import sqlite3
        db=sqlite3.connect(self.path,timeout=15)
        db.row_factory=sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        return db
    async def batch(self, statements):
        with self.connect() as db:
            result=[]
            for sql,args in statements:
                cur=db.execute(sql,args)
                result.append([dict(row) for row in cur.fetchall()] if cur.description else [])
            return result
    async def query(self,sql,args=()):
        return (await self.batch([(sql,args)]))[0]

class D1Store:
    def __init__(self,binding):self.binding=binding
    async def batch(self,statements):
        prepared=[self.binding.prepare(sql).bind(*args) for sql,args in statements]
        result=await self.binding.batch(prepared)
        return [row.get('results',[]) for row in result]
    async def query(self,sql,args=()):
        return (await self.batch([(sql,args)]))[0]
