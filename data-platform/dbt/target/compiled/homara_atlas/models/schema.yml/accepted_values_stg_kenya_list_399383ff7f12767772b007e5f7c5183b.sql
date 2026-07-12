
    
    

with all_values as (

    select
        property_type as value_field,
        count(*) as n_records

    from "homara_atlas"."main_staging"."stg_kenya_listings"
    group by property_type

)

select *
from all_values
where value_field not in (
    'Apartment','Villa','Townhouse','Bungalow','Maisonette','Land','Office','Retail','Warehouse'
)


