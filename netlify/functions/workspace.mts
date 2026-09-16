import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { applyAction, viewFor, DomainError, type State, type Role, type Action } from '../../shared/domain.ts';

function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export default async (req:Request) => {
 if(!['GET','POST'].includes(req.method))return json({error:'methodNotAllowed'},405);
 if(req.method==='POST'){
  try {verifyRequestOrigin(req);}catch{return json({error:'forbidden'},403);}
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'invalidInput'},415);
 }
 const user=await getUser();if(!user)return json({error:'unauthorized'},401);
 // Never derive authorization from user_metadata or any client-provided member ID.
 const role:Role|undefined=user.roles?.includes('manager')?'manager':user.roles?.includes('staff')?'staff':undefined;
 if(!role)return json({error:'forbidden'},403);
 let action:Action|undefined;
 if(req.method==='POST'){
  const text=await req.text();if(text.length>12000)return json({error:'invalidInput'},413);
  try{action=JSON.parse(text);if(!action||typeof action.type!=='string')throw new Error();}catch{return json({error:'invalidInput'},400);}
 }
 try {
  const db=getDatabase(),client=await db.pool.connect();
  try{
   await client.query('BEGIN');
   const {rows}=await client.query("SELECT version, data FROM team_workspace WHERE id=$1 FOR UPDATE",['hoflustorf']);
   if(!rows[0])throw new Error('Workspace not initialized');
   let s=rows[0].data as State;
   let member=s.members.find(m=>m.id===user.id),profileChanged=false;
   if(!member){member={id:user.id,name:(user.name||'Teammitglied').slice(0,100),role,weeklyMinutes:role==='staff'?2100:0};s.members.push(member);profileChanged=true;}
   // Role changes in Identity become effective on the next verified request.
   if(member.role!==role){member.role=role;member.weeklyMinutes=role==='staff'?2100:0;profileChanged=true;}
   if(profileChanged){
    await client.query("UPDATE team_workspace SET data=$1, version=version+1, updated_at=now() WHERE id=$2",[JSON.stringify(s),'hoflustorf']);
    await client.query("INSERT INTO team_audit(actor_id,action,payload,workspace_version) SELECT $1,$2,$3,version FROM team_workspace WHERE id=$4",[user.id,'member.sync',JSON.stringify(member),'hoflustorf']);
   }
   if(action){
    const generatedId=crypto.randomUUID();
    s=applyAction(s,user.id,action,generatedId,new Date().toISOString());
    await client.query("UPDATE team_workspace SET data=$1, version=version+1, updated_at=now() WHERE id=$2",[JSON.stringify(s),'hoflustorf']);
    await client.query("INSERT INTO team_audit(actor_id,action,payload,workspace_version) SELECT $1,$2,$3,version FROM team_workspace WHERE id=$4",[user.id,action.type,JSON.stringify({input:action.payload,generatedId}),'hoflustorf']);
   }
   await client.query('COMMIT');
   return json(viewFor(s,user.id));
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){
  if(error instanceof DomainError)return json({error:error.code},error.code==='forbidden'?403:error.code==='conflict'?409:400);
  // No entry text, personal information or database connection details in logs.
  console.error('Workspace request failed',error instanceof Error?error.name:'UnknownError');
  return json({error:'serverUnavailable'},503);
 }
};
export const config:Config={path:'/api/workspace'};
