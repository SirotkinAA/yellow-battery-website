// All statements are parameterized. D1 batch executes atomically.
export class AuthStore {
 constructor(db){this.db=db;}
 q(sql,...args){return this.db.prepare(sql).bind(...args);}
 user(email){return this.q('SELECT * FROM corp_users WHERE email=?',email).first();}
 byId(id){return this.q('SELECT * FROM corp_users WHERE id=?',id).first();}
 async users(){return (await this.q('SELECT id,email,phone,name,roles,status,email_verified,phone_verified FROM corp_users ORDER BY name').all()).results;}
 async limit(key,now,seconds,max){
  const row=await this.q('INSERT INTO corp_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING count',key,now+seconds,now,now,now+seconds).first();
  return row.count<=max;
 }
 async invite(user,challenge,actor,now){
  await this.db.batch([
   this.q('INSERT INTO corp_users(id,email,phone,name,roles,status,created_at) VALUES(?,?,?,?,?,\'invited\',?)',user.id,user.email,user.phone,user.name,JSON.stringify(user.roles),now),
   this.challengeStatement(challenge),this.auditStatement(actor,user.id,'invited',now)
  ]);
 }
 challengeStatement(c){return this.q('INSERT INTO corp_challenges(token_hash,user_id,user_version,purpose,expires_at) VALUES(?,?,?,?,?)',c.token_hash,c.user_id,c.user_version,c.purpose,c.expires_at);}
 async challenge(c){await this.challengeStatement(c).run();}
 async renew(user,c,actor,now,contacts=null){
  const out=await this.db.batch([
   this.q('UPDATE corp_users SET email=?,phone=?,status=\'invited\',password_hash=NULL,email_verified=0,phone_verified=0,version=version+1 WHERE id=? AND version=? AND NOT EXISTS(SELECT 1 FROM json_each(corp_users.roles) WHERE value=\'admin\') RETURNING id',contacts?.email||user.email,contacts?.phone||user.phone,user.id,user.version),
   this.q('INSERT INTO corp_challenges(token_hash,user_id,user_version,purpose,expires_at) SELECT ?,id,version,\'invite\',? FROM corp_users WHERE id=? AND version=? AND status=\'invited\'',c.token_hash,c.expires_at,user.id,user.version+1),
   this.auditStatement(actor,user.id,contacts?'admin_recovery':'invitation_renewed',now)
  ]);return !!out[0].results?.length;
 }
 getChallenge(hash){return this.q('SELECT c.*,u.email,u.phone,u.status,u.email_verified,u.phone_verified,u.version FROM corp_challenges c JOIN corp_users u ON u.id=c.user_id WHERE c.token_hash=?',hash).first();}
 async emailAndCode(hash,code,now){
  // A link has a single send attempt. A new recovery request is required after expiry/failure.
  return this.q('UPDATE corp_challenges SET email_at=?,code_hash=?,code_expires=? WHERE token_hash=? AND consumed=0 AND expires_at>? AND email_at IS NULL AND user_version=(SELECT version FROM corp_users WHERE id=user_id) RETURNING user_id',now,code,now+300,hash,now).first();
 }
 async attempt(hash,now){return this.q('UPDATE corp_challenges SET attempts=attempts+1 WHERE token_hash=? AND consumed=0 AND expires_at>? AND code_expires>? AND email_at IS NOT NULL AND attempts<5 RETURNING *',hash,now,now).first();}
 async finish(hash,code,password,now){
  const exists='EXISTS(SELECT 1 FROM corp_challenges c WHERE c.token_hash=? AND c.code_hash=? AND c.user_id=corp_users.id AND c.user_version=corp_users.version AND c.consumed=0 AND c.expires_at>? AND c.code_expires>? AND c.attempts<=5 AND c.email_at IS NOT NULL)';
  const result=await this.db.batch([
   this.q(`UPDATE corp_users SET password_hash=?,status='active',email_verified=1,phone_verified=1,version=version+1 WHERE status!='disabled' AND ${exists} RETURNING id`,password,hash,code,now,now),
   // Only the successful password update advances the version by one. Every old session and link then fails.
   this.q('UPDATE corp_challenges SET consumed=1 WHERE token_hash=? AND user_version+1=(SELECT version FROM corp_users WHERE id=user_id)',hash),
   this.q('DELETE FROM corp_sessions WHERE user_id=(SELECT user_id FROM corp_challenges WHERE token_hash=?) AND user_version!=(SELECT version FROM corp_users WHERE id=user_id)',hash)
  ]);
  return result[0].results?.[0]?.id||null;
 }
 async session(hash,user,expiry){await this.q('INSERT INTO corp_sessions VALUES(?,?,?,?)',hash,user.id,user.version,expiry).run();}
 sessionUser(hash,now){return this.q('SELECT u.* FROM corp_sessions s JOIN corp_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND s.user_version=u.version AND u.status=\'active\'',hash,now).first();}
 async logout(hash){await this.q('DELETE FROM corp_sessions WHERE token_hash=?',hash).run();}
 auditStatement(actor,subject,action,now){return this.q('INSERT INTO corp_audit VALUES(?,?,?,?,?)',crypto.randomUUID(),actor,subject,action,now);}
 async audit(actor,subject,action,now){await this.auditStatement(actor,subject,action,now).run();}
 async change(actor,id,roles,status,now){
  // This phase keeps the original administrator immutable; no accidental removal of the last admin.
  const out=await this.db.batch([
   this.q('UPDATE corp_users SET roles=?,status=?,version=version+1 WHERE id=? AND NOT EXISTS(SELECT 1 FROM json_each(corp_users.roles) WHERE value=\'admin\') RETURNING id',JSON.stringify(roles),status,id),
   this.auditStatement(actor,id,'access_changed',now)
  ]);return !!out[0].results?.length;
 }
}
