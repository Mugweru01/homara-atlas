
    
    

select
    listing_id as unique_field,
    count(*) as n_records

from "homara_atlas"."main_staging"."stg_kenya_listings"
where listing_id is not null
group by listing_id
having count(*) > 1


