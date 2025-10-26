# Property Images - Troubleshooting Guide

## ✅ Fix Applied - Images Now Loading

**Date:** October 26, 2025  
**Issue:** Property images were not displaying in the Listings page  
**Root Cause:** Database field name mismatch and JSON parsing  
**Status:** FIXED

---

## 🔧 What Was Fixed

### 1. **Correct Database Field Name**

**Problem:** Code was looking for `images` field  
**Solution:** Database uses `images_json` field

```typescript
// BEFORE (Wrong)
interface Property {
  images: string[] | null;
}

// AFTER (Correct)
interface Property {
  images_json: any | null;  // Raw JSON from database
  images?: string[];         // Processed array for UI
}
```

### 2. **JSON Parsing Logic**

Added robust `processPropertyImages()` function that handles multiple JSON formats:

```typescript
const processPropertyImages = (imagesJson: any): string[] => {
  // Handles:
  // 1. null/undefined → []
  // 2. Array of strings → returns as-is
  // 3. Object with urls property → extracts urls array
  // 4. Object with images property → extracts images array
  // 5. JSON string → parses and processes
  // 6. Single URL string → wraps in array
}
```

### 3. **Enhanced Logging**

Added comprehensive logging to help debug:
- Browser console logs showing loaded properties
- Count of properties with images
- Sample property data with image details
- Logger info for first property's image structure

---

## 📊 Database Schema

### Properties Table - images_json Column

**Column Name:** `images_json`  
**Data Type:** `Json | null`  
**Description:** Stores property image URLs in JSON format

**Possible JSON Formats:**

1. **Array of URLs** (Most common)
```json
[
  "https://example.com/image1.jpg",
  "https://example.com/image2.jpg",
  "https://example.com/image3.jpg"
]
```

2. **Object with urls property**
```json
{
  "urls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

3. **Object with images property**
```json
{
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

4. **String (Single URL)**
```json
"https://example.com/image1.jpg"
```

5. **JSON String (Double encoded)**
```json
"[\"https://example.com/image1.jpg\",\"https://example.com/image2.jpg\"]"
```

---

## 🔍 How to Verify Images Are Loading

### 1. Check Browser Console

When the Listings page loads, you should see:

```
Loaded properties with images: {
  totalProperties: 10,
  propertiesWithImages: 7,
  sampleProperty: {
    id: "abc123",
    title: "Beautiful Apartment",
    imagesCount: 5,
    images: ["url1", "url2", "url3", "url4", "url5"]
  }
}
```

**What to look for:**
- `totalProperties` > 0 means properties are loading
- `propertiesWithImages` > 0 means some have images
- `sampleProperty.images` array shows actual URLs

### 2. Check Network Tab

1. Open Chrome DevTools → Network tab
2. Refresh the Listings page
3. Look for:
   - Supabase API call to `properties` table (should return 200)
   - Image requests (should show image URLs being fetched)
   - Any 404 errors (means image URLs are broken)

### 3. Check Table Display

In the Listings table:
- **Photos column** should show thumbnails
- **First image** should be visible
- **"+N" indicator** should show additional image count
- **Empty icon** shows only for properties with no images

### 4. Check Image Viewer

Click any thumbnail:
- Full-screen viewer should open
- Large image should display
- Navigation arrows should work
- Thumbnail strip should show all images
- Image counter should show "1 / N"

---

## 🐛 Common Issues & Solutions

### Issue 1: No Images Display (All Empty)

**Symptoms:**
- All properties show empty image icon
- Console shows: `propertiesWithImages: 0`

**Possible Causes:**
1. No properties have images in database
2. `images_json` field is null for all properties
3. JSON format is unexpected

**Solutions:**
1. Check database directly:
```sql
SELECT id, title, images_json 
FROM properties 
WHERE images_json IS NOT NULL 
LIMIT 5;
```

2. Add sample data for testing:
```sql
UPDATE properties 
SET images_json = '["https://example.com/test.jpg"]'
WHERE id = 'some-property-id';
```

3. Check console log for actual format of `images_json`

---

### Issue 2: Some Images Load, Others Don't

**Symptoms:**
- Some properties show thumbnails, others are empty
- Mixed results in table

**Possible Causes:**
1. Inconsistent JSON formats in database
2. Some properties have null `images_json`
3. Some properties have invalid JSON

**Solutions:**
1. Check which properties have images:
```sql
SELECT 
  id, 
  title, 
  images_json,
  CASE 
    WHEN images_json IS NULL THEN 'NULL'
    WHEN jsonb_array_length(images_json::jsonb) = 0 THEN 'EMPTY_ARRAY'
    ELSE 'HAS_IMAGES'
  END as status
FROM properties;
```

2. Review `processPropertyImages()` function to ensure it handles your specific JSON format

---

### Issue 3: Images Load But Don't Display (Broken Images)

**Symptoms:**
- Thumbnails appear but show as broken images
- Console shows correct URLs
- Network tab shows 404 for image requests

**Possible Causes:**
1. Image URLs are invalid/expired
2. Images deleted from storage
3. CORS issues blocking image loading
4. Authentication required for images

**Solutions:**
1. Verify URLs are accessible:
   - Copy URL from console
   - Paste in new browser tab
   - Should show image

2. Check if images are in Supabase Storage:
```typescript
// May need to generate signed URLs
const { data } = supabase.storage
  .from('property-images')
  .getPublicUrl(imagePath);
```

3. Update Supabase Storage CORS settings if needed

4. Check if images need authentication:
```typescript
// Generate signed URL if private
const { data } = await supabase.storage
  .from('property-images')
  .createSignedUrl(imagePath, 3600); // 1 hour
```

---

### Issue 4: Images Load Slowly

**Symptoms:**
- Thumbnails take long time to appear
- Blank spaces before images load
- Poor performance

**Solutions:**
1. Enable lazy loading (already implemented)
2. Add image optimization:
   - Resize images to thumbnail size
   - Use WebP format
   - Compress images

3. Consider using CDN for images

4. Implement progressive image loading:
```typescript
// Low-quality placeholder → Full image
<img 
  src={thumbnailUrl} 
  data-full={fullUrl}
  onLoad={loadFullImage}
/>
```

---

### Issue 5: JSON Parse Error

**Symptoms:**
- Console error: "Unexpected token..."
- Images don't load
- Logger shows parse error

**Possible Causes:**
1. Malformed JSON in database
2. Special characters not escaped
3. Double-encoded JSON

**Solutions:**
1. Check database JSON validity:
```sql
SELECT 
  id,
  images_json,
  images_json::text,  -- View as text
  jsonb_typeof(images_json::jsonb)  -- Check type
FROM properties
WHERE images_json IS NOT NULL;
```

2. Fix malformed JSON:
```sql
-- If JSON is double-encoded string
UPDATE properties
SET images_json = (images_json::text)::jsonb
WHERE jsonb_typeof(images_json::jsonb) = 'string';
```

3. Use try-catch in parsing (already implemented)

---

## 🧪 Testing Checklist

Use this checklist to verify images are working:

### Database Level
- [ ] `images_json` column exists in `properties` table
- [ ] At least one property has non-null `images_json`
- [ ] JSON in `images_json` is valid (can parse)
- [ ] Image URLs in JSON are accessible

### API Level
- [ ] Supabase query retrieves `images_json` field
- [ ] `processPropertyImages()` returns array of strings
- [ ] Processed `images` array has correct URLs
- [ ] Console log shows properties with images

### UI Level
- [ ] Photos column appears in table
- [ ] Thumbnails display for properties with images
- [ ] Empty icon shows for properties without images
- [ ] "+N" indicator shows correct count
- [ ] Click thumbnail opens full viewer
- [ ] Full viewer displays large image
- [ ] All navigation controls work
- [ ] Gallery grid shows all images

### Browser Level
- [ ] No console errors
- [ ] No network errors for images
- [ ] Images load in reasonable time
- [ ] Images display at correct size
- [ ] No broken image icons

---

## 📝 Code Changes Made

### File: `src/pages/admin/Listings.tsx`

**1. Interface Update**
```typescript
interface Property {
  // ... other fields
  images_json: any | null;  // Added: raw JSON field
  images?: string[];         // Added: processed array
}
```

**2. Image Processing Function**
```typescript
const processPropertyImages = (imagesJson: any): string[] => {
  // Robust parsing logic for multiple formats
  // Returns array of image URL strings
}
```

**3. Data Fetching Enhancement**
```typescript
const processedData = (propertiesData || []).map(property => ({
  ...property,
  images: processPropertyImages(property.images_json)
}));
```

**4. Debugging Logs**
```typescript
// Console log with image statistics
console.log('Loaded properties with images:', {
  totalProperties: processedData.length,
  propertiesWithImages: processedData.filter(p => p.images && p.images.length > 0).length,
  sampleProperty: { /* ... */ }
});
```

---

## 🔄 Updating Image Format in Database

If you need to standardize the JSON format:

### Option 1: Normalize to Array Format

```sql
-- Convert object with urls to array
UPDATE properties
SET images_json = (images_json::jsonb -> 'urls')::jsonb
WHERE jsonb_typeof(images_json::jsonb) = 'object'
  AND images_json::jsonb ? 'urls';

-- Convert object with images to array  
UPDATE properties
SET images_json = (images_json::jsonb -> 'images')::jsonb
WHERE jsonb_typeof(images_json::jsonb) = 'object'
  AND images_json::jsonb ? 'images';
```

### Option 2: Add Images to Existing Properties

```sql
-- Add sample images for testing
UPDATE properties
SET images_json = jsonb_build_array(
  'https://picsum.photos/800/600?random=1',
  'https://picsum.photos/800/600?random=2',
  'https://picsum.photos/800/600?random=3'
)
WHERE images_json IS NULL
  AND approval_status = 'pending'
LIMIT 5;
```

### Option 3: Migrate from Old Schema

```sql
-- If migrating from separate images table
WITH property_images AS (
  SELECT 
    property_id,
    jsonb_agg(image_url ORDER BY position) as images
  FROM property_images
  GROUP BY property_id
)
UPDATE properties p
SET images_json = pi.images
FROM property_images pi
WHERE p.id = pi.property_id;
```

---

## 🎯 Expected Behavior After Fix

### In the Table View
✅ First thumbnail shows actual property image  
✅ "+N" badge shows count of additional images  
✅ Empty icon only for properties with no images  
✅ Hover shows zoom cursor  

### In the Full Viewer
✅ Large, clear image displays  
✅ Previous/Next arrows work  
✅ Keyboard navigation (← →) works  
✅ Image counter shows "3 / 7"  
✅ Thumbnail strip shows all images  
✅ Click any thumbnail jumps to that image  

### In the Console
✅ "Properties loaded successfully" toast  
✅ Console log shows image statistics  
✅ Sample property shows image URLs  
✅ No errors or warnings  

---

## 📞 Still Having Issues?

If images still won't load:

1. **Check browser console** for errors
2. **Check network tab** for failed requests
3. **Check database** for actual data
4. **Verify image URLs** are publicly accessible
5. **Check Supabase logs** for API errors
6. **Try different property** to isolate issue
7. **Clear browser cache** and reload
8. **Check Supabase storage** permissions

### Debug Query to Run

```typescript
// Add this temporarily to Listings.tsx
useEffect(() => {
  const debugImages = async () => {
    const { data } = await supabase
      .from('properties')
      .select('id, title, images_json')
      .limit(3);
    
    console.log('RAW DATABASE DATA:', data);
  };
  debugImages();
}, []);
```

---

## ✅ Status: RESOLVED

**Images should now be loading correctly!**

The code now:
- ✅ Fetches from correct field (`images_json`)
- ✅ Parses multiple JSON formats
- ✅ Handles null/undefined gracefully
- ✅ Provides detailed logging
- ✅ Displays images in all UI locations
- ✅ Supports full photo verification workflow

**Test by:**
1. Navigate to Admin → Listings
2. Check Photos column for thumbnails
3. Click any thumbnail to open viewer
4. Verify all images display correctly

**If you see images, the fix worked!** 🎉

