set pcb.test_active='true';set pcb.test_owner='true';
do $$begin
 if public.allocate_management_numbers_for_area('ISO',1)<>101 then raise exception 'ISO highwater';end if;
 if public.allocate_management_numbers_for_area('K_BEAUTY',1)<>101 then raise exception 'Beauty independent';end if;
 if public.allocate_management_numbers_for_area('ISO',2)<>102 then raise exception 'Reserved numbers reused';end if;
 if public.allocate_management_numbers_for_area('ISO',1)<>104 then raise exception 'Reserved range reused';end if;
 if public.import_legacy_certification_row('{"businessArea":"ISO","managementNo":"5"}') ->> 'label' <> 'LEGACY-ISO-000005' then raise exception 'ISO import label';end if;
 if public.import_legacy_certification_row('{"businessArea":"K_BEAUTY","managementNo":"5"}') ->> 'label' <> 'LEGACY-K_BEAUTY-000005' then raise exception 'Beauty import label';end if;
 begin
  perform public.allocate_management_numbers_for_area('ISO',1,5);
  raise exception 'Expected duplicate denial';
 exception when raise_exception then if sqlerrm<>'Management number already exists within area' then raise;end if;end;
 begin
  insert into public.jobs values('ISO',5);
  raise exception 'Expected unique violation';
 exception when unique_violation then null;end;
 begin
  perform public.allocate_management_numbers_for_area('OTHER',1);
  raise exception 'Expected unknown area denial';
 exception when raise_exception then if sqlerrm<>'Explicit business area required' then raise;end if;end;
 if has_table_privilege('authenticated','public.management_number_allocations','SELECT') then raise exception 'Direct read allowed';end if;
 if has_table_privilege('authenticated','public.management_number_allocations','UPDATE') then raise exception 'Direct edit allowed';end if;
 if has_function_privilege('anon','public.allocate_management_numbers_for_area(text,integer,integer)','EXECUTE') then raise exception 'Anonymous allocation allowed';end if;
 begin
  perform public.allocate_management_numbers_for_area('ISO',0);
  raise exception 'Expected invalid count denial';
 exception when raise_exception then if sqlerrm<>'Count must be between 1 and 100' then raise;end if;end;
 begin
  perform public.allocate_management_numbers(1);
  raise exception 'Expected obsolete allocator denial';
 exception when raise_exception then if sqlerrm<>'Business area required. Refresh the application before registering' then raise;end if;end;
 begin
  perform public.allocate_management_numbers_for_area('ISO',2,2147483647);
  raise exception 'Expected overflow denial';
 exception when raise_exception then if sqlerrm<>'Management number range exhausted' then raise;end if;end;
end;$$;
set pcb.test_owner='false';
do $$begin
 begin
  perform public.allocate_management_numbers_for_area('ISO',1,30);
  raise exception 'Expected owner denial';
 exception when raise_exception then if sqlerrm<>'Only owner can reserve historical numbers' then raise;end if;end;
end;$$;
set pcb.test_active='false';
do $$begin
 begin
  perform public.get_management_number_policy();raise exception 'Expected inactive denial';
 exception when raise_exception then if sqlerrm<>'Active staff required' then raise;end if;end;
end;$$;
