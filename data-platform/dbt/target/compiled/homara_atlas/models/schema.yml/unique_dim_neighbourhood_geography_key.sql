
    
    

select
    geography_key as unique_field,
    count(*) as n_records

from "homara_atlas"."main_core"."dim_neighbourhood"
where geography_key is not null
group by geography_key
having count(*) > 1


