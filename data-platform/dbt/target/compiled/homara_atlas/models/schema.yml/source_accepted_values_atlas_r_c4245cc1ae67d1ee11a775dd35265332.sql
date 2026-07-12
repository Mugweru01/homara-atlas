
    
    

with all_values as (

    select
        source as value_field,
        count(*) as n_records

    from "homara_atlas"."atlas_raw"."kenya_listings"
    group by source

)

select *
from all_values
where value_field not in (
    'synthetic_public_data','kenya_knbs','openstreetmap','kenya_land_registry'
)


