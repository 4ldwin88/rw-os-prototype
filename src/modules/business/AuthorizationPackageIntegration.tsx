import { useEffect, useState } from 'react';
import type { ProjectState } from '../../domain/project-state/projectState';
import { supabaseProjectStateRepository, type ProjectStateStageRequirement } from '../../infrastructure/project-state/supabaseProjectStateRepository';
import { AuthorizationPackageWorkspace } from './AuthorizationPackageWorkspace';

export function AuthorizationPackageIntegration({projectStateId}:{projectStateId:string}){
 const[state,setState]=useState<ProjectState|null>(null),[requirements,setRequirements]=useState<ProjectStateStageRequirement[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{let active=true;Promise.all([supabaseProjectStateRepository.get(projectStateId),supabaseProjectStateRepository.stageRequirements(projectStateId,'authorization')]).then(([project,req])=>{if(active){setState(project);setRequirements(req)}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Authorization state could not load.')});return()=>{active=false}},[projectStateId]);
 if(error)return <p className="error-message">{error}</p>;
 if(state?.stage!=='authorization')return null;
 async function authorize(){if(!window.confirm(`Authorize ${state?.name??'this Project State'} as a Ridgewood Project?`))return;setBusy(true);setError(null);try{await supabaseProjectStateRepository.authorize(projectStateId);window.location.reload()}catch(e){setError(e instanceof Error?e.message:'Project Authorization failed.')}finally{setBusy(false)}}
 return <section className="panel"><div className="section-heading"><div><p className="eyebrow">Authorization</p><h3>Governed authorization package</h3></div></div>{error?<p className="error-message">{error}</p>:null}<AuthorizationPackageWorkspace projectStateId={projectStateId} requirements={requirements} onRequirementsChanged={setRequirements} onAuthorize={()=>void authorize()} busy={busy}/></section>;
}
