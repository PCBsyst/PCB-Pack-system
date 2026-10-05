export type ManagementArea = "ISO" | "K_BEAUTY";
type RpcClient = {rpc:(name:string,args?:Record<string,unknown>)=>PromiseLike<{data:unknown;error:{code?:string;message?:string}|null}>};
export function normalizeManagementArea(value:string):ManagementArea|null {
 const key=value.trim().toUpperCase().replace(/[\s_-]/g,"");
 if(key==="ISO")return "ISO";
 if(["KBEAUTY","K뷰티","뷰티"].includes(key))return "K_BEAUTY";
 return null;
}
export function managementNumberKey(area:ManagementArea,number:string|number){return `${area}:${Number(number)}`;}
export async function readManagementNumberPolicy(client:RpcClient):Promise<"separated"|"legacy"|"unavailable">{
 try{const {data,error}=await client.rpc("get_management_number_policy");if(error)return error.code==="PGRST202"&&error.message?.includes("get_management_number_policy")?"legacy":"unavailable";return data&&typeof data==="object"&&(data as {areasSeparated?:unknown}).areasSeparated===true?"separated":"unavailable";}catch{return "unavailable";}
}
export async function allocateAreaManagementNumbers(client:RpcClient,area:ManagementArea,count:number){
 const result=await client.rpc("allocate_management_numbers_for_area",{p_business_area:area,p_count:count});
 if(result.error?.code==="PGRST202"&&result.error.message?.includes("allocate_management_numbers_for_area")){
  const legacy=await client.rpc("allocate_management_numbers",{p_count:count});return {...legacy,legacy:true};
 }
 return {...result,legacy:false};
}
