"use client";
import {useEffect,useState} from 'react';
import {fetchData} from '@/lib/network';
export function MemoryPhoto({id,token,alt}:{id:string;token:string;alt:string}){
 const [src,setSrc]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true,url='';const controller=new AbortController();setSrc('');setError('');
 fetchData(`/api/photo?id=${encodeURIComponent(id)}`,{signal:controller.signal,headers:{Authorization:`Bearer ${token}`}},r=>r.blob(),30000).then(blob=>{if(live){url=URL.createObjectURL(blob);setSrc(url)}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Foto indisponível.')});
 const retry=()=>{if(live)setAttempt(n=>n+1)};window.addEventListener('online',retry);
 return()=>{live=false;controller.abort();window.removeEventListener('online',retry);if(url)URL.revokeObjectURL(url)}},[id,token,attempt]);
 return src?<img className="memory-photo" src={src} alt={alt}/>:<div className="photo-loading" role="status">{error?<><p>{error}</p><button type="button" className="text-button" onClick={()=>setAttempt(n=>n+1)}>Tentar carregar foto</button></>:'Revelando fotografia…'}</div>;
}
