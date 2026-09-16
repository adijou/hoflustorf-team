export type Lang = 'de' | 'es';
export type Role = 'manager' | 'staff';
export type Category = 'horses' | 'pasture' | 'maintenance' | 'other';
export type Repeat = 'once' | 'daily' | 'weekly' | 'monthly';
export interface Member { id: string; name: string; role: Role; weeklyMinutes: number }
export interface Task { id: string; titleDe: string; titleEs: string; notes: string; category: Category; budget: number; assignee: string; startDate: string; endDate?: string; repeat: Repeat; twoPeople: boolean; status: 'active' | 'proposed'; createdBy: string }
export interface Entry { id: string; memberId: string; date: string; start: number; end: number; pause: number; minutes: number; taskId: string; note: string; version: number; voided: boolean }
export interface Completion { key: string; by: string; at: string }
export interface Report { memberId: string; month: string; status: 'submitted' | 'approved'; at: string; by: string; note: string }
export interface State { members: Member[]; tasks: Task[]; entries: Entry[]; completions: Completion[]; reports: Report[] }
export interface View extends State { me: Member; totals: Record<string, number> }
export type Action = { type: string; payload: Record<string, unknown> };
export class DomainError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
export const emptyState = (): State => ({members:[],tasks:[],entries:[],completions:[],reports:[]});
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function dateValid(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s; }
export function addDays(s: string, n: number) { const d=new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function weekStart(s: string) { const day=new Date(s+'T12:00:00Z').getUTCDay(); return addDays(s,-((day+6)%7)); }
export const keyFor = (id:string,date:string) => `${id}:${date}`;
export function occurs(t: Task, date:string) {
 if(t.status!=='active'||date<t.startDate||(t.endDate&&date>t.endDate))return false;
 if(t.repeat==='daily')return true;
 if(t.repeat==='once')return date===t.startDate;
 if(t.repeat==='weekly')return new Date(date+'T12:00:00Z').getUTCDay()===new Date(t.startDate+'T12:00:00Z').getUTCDay();
 const [y,m,d]=date.split('-').map(Number); const last=new Date(Date.UTC(y,m,0)).getUTCDate(); return d===Math.min(Number(t.startDate.slice(8)),last);
}
export function duration(start:number,end:number,pause:number){ if(![start,end,pause].every(Number.isInteger)||start<0||end>1440||end<=start||pause<0||pause>=end-start)throw new DomainError('invalidTime');return end-start-pause; }
export const reportFor=(s:State,id:string,month:string)=>s.reports.find(r=>r.memberId===id&&r.month===month);
export function taskTotals(s:State){const r:Record<string,number>={};for(const e of s.entries)if(!e.voided)r[keyFor(e.taskId,e.date)]=(r[keyFor(e.taskId,e.date)]||0)+e.minutes;return r;}
export function viewFor(s:State,id:string):View { const me=s.members.find(m=>m.id===id);if(!me)throw new DomainError('forbidden');return {...s,me,entries:me.role==='manager'?s.entries:s.entries.filter(e=>e.memberId===id),reports:me.role==='manager'?s.reports:s.reports.filter(r=>r.memberId===id),totals:taskTotals(s)}; }
function string(p:Record<string,unknown>,key:string,max=500){const v=p[key];if(typeof v!=='string'||v.length>max)throw new DomainError('invalidInput');return v.trim();}
function integer(p:Record<string,unknown>,key:string,min:number,max:number){const n=p[key];if(typeof n!=='number'||!Number.isInteger(n)||n<min||n>max)throw new DomainError('invalidInput');return n;}
function requireManager(m:Member){if(m.role!=='manager')throw new DomainError('forbidden');}
export function applyAction(input: State, actorId:string, action:Action, newId:string, now:string):State {
 const s=structuredClone(input),m=s.members.find(x=>x.id===actorId);if(!m)throw new DomainError('forbidden');
 const p=action.payload, currentDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 if(!p||typeof p!=='object'||Array.isArray(p))throw new DomainError('invalidInput');
 switch(action.type){
  case 'task.create': {
   const titleDe=string(p,'titleDe',150),titleEs=string(p,'titleEs',150);if(!titleDe&&!titleEs)throw new DomainError('titleRequired');
   const startDate=string(p,'startDate',10);if(!dateValid(startDate))throw new DomainError('invalidDate');
   const category=string(p,'category') as Category,repeat=string(p,'repeat') as Repeat,assignee=string(p,'assignee',100);
   if(!['horses','pasture','maintenance','other'].includes(category)||!['once','daily','weekly','monthly'].includes(repeat)||(assignee&&!s.members.some(x=>x.id===assignee)))throw new DomainError('invalidInput');
   if(typeof p.twoPeople!=='boolean')throw new DomainError('invalidInput');
   s.tasks.push({id:newId,titleDe,titleEs,notes:string(p,'notes',1000),category,budget:integer(p,'budget',0,2880),assignee,startDate,repeat,twoPeople:p.twoPeople,status:m.role==='manager'?'active':'proposed',createdBy:actorId});break;
  }
  case 'task.approve': {requireManager(m);const t=s.tasks.find(x=>x.id===p.id);if(!t)throw new DomainError('notFound');t.status='active';break;}
  case 'task.pause': {requireManager(m);const t=s.tasks.find(x=>x.id===p.id);if(!t)throw new DomainError('notFound');t.endDate=currentDate;break;}
  case 'task.complete': {
   const t=s.tasks.find(x=>x.id===p.id),date=string(p,'date',10);if(!t||!dateValid(date)||!occurs(t,date)||date>currentDate)throw new DomainError('invalidDate');
   const k=keyFor(t.id,date);if(typeof p.done!=='boolean')throw new DomainError('invalidInput');
   s.completions=s.completions.filter(c=>c.key!==k);if(p.done)s.completions.push({key:k,by:actorId,at:now});break;
  }
  case 'entry.save': {
   const id=string(p,'id',100),existing=id?s.entries.find(e=>e.id===id):undefined;
   if(id&&!existing)throw new DomainError('notFound');
   if(existing&&(existing.memberId!==actorId||existing.voided))throw new DomainError('forbidden');
   if(existing&&existing.version!==p.version)throw new DomainError('conflict');
   const date=string(p,'date',10);if(!dateValid(date)||date>currentDate)throw new DomainError('invalidDate');
   if(reportFor(s,actorId,date.slice(0,7))||(existing&&reportFor(s,actorId,existing.date.slice(0,7))))throw new DomainError('reportLocked');
   const taskId=string(p,'taskId',100),t=s.tasks.find(x=>x.id===taskId);
   // Unplanned work can always be reported without inventing a task.
   if(taskId&&(!t||!occurs(t,date)))throw new DomainError('invalidTask');
   const note=string(p,'note',1000);if(!taskId&&!note)throw new DomainError('noteRequired');
   const start=integer(p,'start',0,1439),end=integer(p,'end',1,1440),pause=integer(p,'pause',0,1439),minutes=duration(start,end,pause);
   if(s.entries.some(e=>!e.voided&&e.id!==id&&e.memberId===actorId&&e.date===date&&start<e.end&&end>e.start))throw new DomainError('overlap');
   const entry:Entry={id:id||newId,memberId:actorId,date,start,end,pause,minutes,taskId,note,version:(existing?.version||0)+1,voided:false};
   if(existing)s.entries=s.entries.map(e=>e.id===id?entry:e);else s.entries.push(entry);break;
  }
  case 'entry.void': {
   const e=s.entries.find(x=>x.id===p.id);if(!e)throw new DomainError('notFound');if(e.memberId!==actorId)throw new DomainError('forbidden');
   if(reportFor(s,actorId,e.date.slice(0,7)))throw new DomainError('reportLocked');if(e.version!==p.version)throw new DomainError('conflict');
   if(!string(p,'reason',500))throw new DomainError('noteRequired');e.voided=true;e.version++;break;
  }
  case 'report.submit': {
   const month=string(p,'month',7);if(!/^\d{4}-\d{2}$/.test(month)||!dateValid(month+'-01')||month>currentDate.slice(0,7))throw new DomainError('invalidDate');
   if(reportFor(s,actorId,month))throw new DomainError('reportLocked');if(!s.entries.some(e=>e.memberId===actorId&&!e.voided&&e.date.startsWith(month)))throw new DomainError('emptyReport');
   s.reports.push({memberId:actorId,month,status:'submitted',at:now,by:actorId,note:''});break;
  }
  case 'report.approve': {requireManager(m);const r=reportFor(s,string(p,'memberId',100),string(p,'month',7));if(!r||r.status!=='submitted')throw new DomainError('notFound');if(r.memberId===actorId)throw new DomainError('selfApproval');r.status='approved';r.at=now;r.by=actorId;break;}
  case 'report.reopen': {requireManager(m);const note=string(p,'note',500);if(!note)throw new DomainError('noteRequired');const memberId=string(p,'memberId',100),month=string(p,'month',7);if(!reportFor(s,memberId,month))throw new DomainError('notFound');s.reports=s.reports.filter(r=>r.memberId!==memberId||r.month!==month);break;}
  default:throw new DomainError('invalidAction');
 }
 return s;
}
export function csv(rows: unknown[][]){return '\uFEFF'+rows.map(row=>row.map(v=>{let x=String(v??'');if(/^[\s]*[=+@-]/.test(x))x="'"+x;return '"'+x.replaceAll('"','""')+'"';}).join(';')).join('\r\n');}
