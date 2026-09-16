import {addDays,today,weekStart,type State} from '../shared/domain';
export function demoState():State {
 const date=today(),mon=weekStart(date);
 return {
  members:[{id:'demo-manager',name:'Hofleitung',role:'manager',weeklyMinutes:0},{id:'demo-a',name:'Teammitglied A',role:'staff',weeklyMinutes:2100},{id:'demo-b',name:'Teammitglied B',role:'staff',weeklyMinutes:2100}],
  tasks:[
   {id:'morning',titleDe:'Morgenrunde im Stall',titleEs:'Ronda de mañana en el establo',notes:'Füttern · Tränken prüfen · Misten · Pferde kontrollieren',category:'horses',budget:120,assignee:'demo-a',startDate:addDays(mon,-7),repeat:'daily',twoPeople:false,status:'active',createdBy:'demo-manager'},
   {id:'pasture',titleDe:'Weidegang & Zäune kontrollieren',titleEs:'Salida al pasto y revisión de cercas',notes:'Tore, Wasser und Weideflächen kontrollieren.',category:'pasture',budget:45,assignee:'demo-b',startDate:addDays(mon,-7),repeat:'daily',twoPeople:false,status:'active',createdBy:'demo-manager'},
   {id:'evening',titleDe:'Abendrunde im Stall',titleEs:'Ronda de tarde en el establo',notes:'Füttern, Wasser und letzte Kontrolle.',category:'horses',budget:75,assignee:'demo-b',startDate:addDays(mon,-7),repeat:'daily',twoPeople:false,status:'active',createdBy:'demo-manager'},
   {id:'fence',titleDe:'Zaun am unteren Paddock reparieren',titleEs:'Reparar la cerca del paddock inferior',notes:'Material zuerst prüfen. Für diesen Beispielauftrag sind zwei Personen vorgesehen.',category:'maintenance',budget:120,assignee:'',startDate:date,repeat:'once',twoPeople:true,status:'active',createdBy:'demo-manager'},
   {id:'hay',titleDe:'Heulager aufräumen',titleEs:'Ordenar el almacén de heno',notes:'Vorschlag aus dem Team.',category:'maintenance',budget:60,assignee:'',startDate:date,repeat:'weekly',twoPeople:false,status:'proposed',createdBy:'demo-b'}
  ],
  entries:[{id:'sample-a',memberId:'demo-a',date,start:420,end:510,pause:0,minutes:90,taskId:'morning',note:'Beispielrapport',version:1,voided:false},{id:'sample-b',memberId:'demo-b',date,start:450,end:510,pause:0,minutes:60,taskId:'morning',note:'Beispiel: gemeinsam gearbeitet',version:1,voided:false}],
  completions:[{key:'morning:'+date,by:'demo-a',at:new Date().toISOString()}],reports:[]
 };
}
