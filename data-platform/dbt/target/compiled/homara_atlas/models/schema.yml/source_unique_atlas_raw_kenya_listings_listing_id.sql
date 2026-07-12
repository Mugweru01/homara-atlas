
    
    

select
    listing_id as unique_field,
    count(*) as n_records

from "homara_atlas"."atlas_raw"."kenya_listings"
where listing_id is not null
group by listing_id
having count(*) > 1


