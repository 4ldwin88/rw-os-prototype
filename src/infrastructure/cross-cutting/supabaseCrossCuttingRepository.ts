import { supabase } from '../auth/supabaseClient';

export type WorkStatus='open'|'in_progress'|'blocked'|'done'|'cancelled';
export type KnowledgeState='known'|'unknown'|'unverified'|'not_applicable';
export type CrossCuttingAction={id:string;title:string;dueDate?:string;status:WorkStatus;ownerUserId?:string;updatedAt:string};
export type CrossCuttingRiskIssue={id:string;kind:string;title:string;severity?:string;status:WorkStatus;ownerUserId?:string;updatedAt:string};
export type CrossCuttingDecision={id:string;decisionType:string;outcome:string;rationale?:string;authorityBasis?:string;actorUserId:string;createdAt:string};
export type CrossCuttingEvidence={id:string;title:string;sourceUrl?:string;sourceSystem:string;provenanceNote?:string;knowledgeState:KnowledgeState;createdAt:string};
export type ProjectStateAttention={level:'clear'|'attention'|'blocked';reasons:string[];overdueActions:number;blockedActions:number;openMaterialRisks:number;unverifiedEvidence:number};
export type ProjectStateCrossCutting={actions:CrossCuttingAction[];risksIssues:CrossCuttingRiskIssue[];decisions:CrossCuttingDecision[];evidence:CrossCuttingEvidence[];attention:ProjectStateAttention};

function fail(error:{message:string}|null,fallback:string){if(error)throw new Error(error.message||fallback)}
const today=()=>new Date().toISOString().slice(0,10);

export function deriveProjectStateAttention(input:Omit<ProjectStateCrossCutting,'attention'>):ProjectStateAttention{
 const overdueActions=input.actions.filter(v=>v.dueDate&&v.dueDate<today()&&!['done','cancelled'].includes(v.status)).length;
 const blockedActions=input.actions.filter(v=>v.status==='blocked').length;
 const openMaterialRisks=input.risksIssues.filter(v=>!['done','cancelled'].includes(v.status)&&['high','critical','material'].includes((v.severity??'').toLowerCase())).length;
 const unverifiedEvidence=input.evidence.filter(v=>v.knowledgeState==='unknown'||v.knowledgeState==='unverified').length;
 const reasons:string[]=[];
 if(blockedActions)reasons.push(`${blockedActions} blocked action${blockedActions===1?'':'s'}`);
 if(openMaterialRisks)reasons.push(`${openMaterialRisks} open material risk${openMaterialRisks===1?'':'s'}`);
 if(overdueActions)reasons.push(`${overdueActions} overdue action${overdueActions===1?'':'s'}`);
 if(unverifiedEvidence)reasons.push(`${unverifiedEvidence} unknown or unverified evidence item${unverifiedEvidence===1?'':'s'}`);
 return {level:blockedActions||openMaterialRisks?'blocked':reasons.length?'attention':'clear',reasons,overdueActions,blockedActions,openMaterialRisks,unverifiedEvidence};
}

export async function listProjectStateCrossCutting(projectStateId:string):Promise<ProjectStateCrossCutting>{
 const [actionsResult,risksResult,decisionsResult,evidenceResult]=await Promise.all([
  supabase.from('actions').select('id,title,due_date,status,owner_user_id,updated_at').eq('project_state_id',projectStateId).order('updated_at',{ascending:false}),
  supabase.from('risk_issues').select('id,kind,title,severity,status,owner_user_id,updated_at').eq('project_state_id',projectStateId).order('updated_at',{ascending:false}),
  supabase.from('decisions').select('id,decision_type,outcome,rationale,authority_basis,actor_user_id,created_at').eq('project_state_id',projectStateId).order('created_at',{ascending:false}),
  supabase.from('evidence_references').select('id,title,source_url,source_system,provenance_note,knowledge_state,created_at').eq('project_state_id',projectStateId).order('created_at',{ascending:false})
 ]);
 fail(actionsResult.error,'Actions could not load.');fail(risksResult.error,'Risks and issues could not load.');fail(decisionsResult.error,'Decisions could not load.');fail(evidenceResult.error,'Evidence could not load.');
 const actions=(actionsResult.data??[]).map(v=>({id:v.id,title:v.title,dueDate:v.due_date??undefined,status:v.status,ownerUserId:v.owner_user_id??undefined,updatedAt:v.updated_at})) as CrossCuttingAction[];
 const risksIssues=(risksResult.data??[]).map(v=>({id:v.id,kind:v.kind,title:v.title,severity:v.severity??undefined,status:v.status,ownerUserId:v.owner_user_id??undefined,updatedAt:v.updated_at})) as CrossCuttingRiskIssue[];
 const decisions=(decisionsResult.data??[]).map(v=>({id:v.id,decisionType:v.decision_type,outcome:v.outcome,rationale:v.rationale??undefined,authorityBasis:v.authority_basis??undefined,actorUserId:v.actor_user_id,createdAt:v.created_at})) as CrossCuttingDecision[];
 const evidence=(evidenceResult.data??[]).map(v=>({id:v.id,title:v.title,sourceUrl:v.source_url??undefined,sourceSystem:v.source_system,provenanceNote:v.provenance_note??undefined,knowledgeState:v.knowledge_state,createdAt:v.created_at})) as CrossCuttingEvidence[];
 const base={actions,risksIssues,decisions,evidence};return {...base,attention:deriveProjectStateAttention(base)};
}

async function rpc(name:string,args:Record<string,unknown>,fallback:string){const {error}=await supabase.rpc(name,args);fail(error,fallback)}
export async function createProjectStateAction(projectStateId:string,title:string,dueDate?:string){await rpc('create_project_state_action_command',{project_state_input:projectStateId,title_input:title,due_date_input:dueDate||null},'Action could not be created.')}
export async function updateProjectStateAction(action:CrossCuttingAction){await rpc('update_project_state_action_command',{action_input:action.id,title_input:action.title,due_date_input:action.dueDate||null,status_input:action.status},'Action could not be updated.')}
export async function createProjectStateRiskIssue(projectStateId:string,kind:string,title:string,severity?:string){await rpc('create_project_state_risk_issue_command',{project_state_input:projectStateId,kind_input:kind,title_input:title,severity_input:severity||null},'Risk or issue could not be created.')}
export async function updateProjectStateRiskIssue(item:CrossCuttingRiskIssue){await rpc('update_project_state_risk_issue_command',{risk_issue_input:item.id,kind_input:item.kind,title_input:item.title,severity_input:item.severity||null,status_input:item.status},'Risk or issue could not be updated.')}
export async function recordProjectStateDecision(projectStateId:string,decisionType:string,outcome:string,rationale?:string,authorityBasis?:string){await rpc('record_project_state_decision_command',{project_state_input:projectStateId,decision_type_input:decisionType,outcome_input:outcome,rationale_input:rationale||null,authority_basis_input:authorityBasis||null},'Decision could not be recorded.')}
export async function createProjectStateEvidence(projectStateId:string,title:string,sourceSystem:string,sourceUrl:string,provenanceNote:string,knowledgeState:KnowledgeState){await rpc('create_project_state_evidence_command',{project_state_input:projectStateId,title_input:title,source_system_input:sourceSystem||'google_drive',source_url_input:sourceUrl||null,provenance_note_input:provenanceNote||null,knowledge_state_input:knowledgeState},'Evidence could not be created.')}
export async function updateProjectStateEvidence(item:CrossCuttingEvidence){await rpc('update_project_state_evidence_command',{evidence_input:item.id,title_input:item.title,source_system_input:item.sourceSystem,source_url_input:item.sourceUrl||null,provenance_note_input:item.provenanceNote||null,knowledge_state_input:item.knowledgeState},'Evidence could not be updated.')}
