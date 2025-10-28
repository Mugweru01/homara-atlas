# Security Page - Comprehensive Testing Guide

## Overview
This guide will help you test all functionality of the Security Settings page (`/admin/security`).

---

## Pre-Testing Setup

1. **Access the page:**
   - Navigate to `http://localhost:8080/admin/security`
   - Or click "Security" in the admin sidebar

2. **Check browser console:**
   - Open Developer Tools (F12)
   - Keep the Console tab open to see any errors

---

## Test 1: Security Preferences ✅

### 1.1 Toggle 2FA Requirement
**Steps:**
1. Locate the "Require Two-Factor Authentication" toggle
2. Click to enable it
3. Wait for success toast: "Security preferences updated"
4. Refresh the page
5. Verify toggle is still enabled

**Expected:** Toggle persists after refresh

### 1.2 Toggle IP Whitelist Requirement
**Steps:**
1. Locate the "Require IP Whitelist" toggle
2. Click to enable it
3. Wait for success toast
4. **Important:** You should see a warning banner if no IPs are whitelisted
5. Refresh the page
6. Verify toggle is still enabled

**Expected:** 
- Toggle works
- Warning banner appears when enabled with no IPs
- State persists

### 1.3 Toggle Concurrent Sessions
**Steps:**
1. Locate the "Allow Concurrent Sessions" toggle
2. Click to enable/disable
3. Wait for success toast
4. Refresh page to verify

**Expected:** Toggle works and persists

### 1.4 Update Session Timeout
**Steps:**
1. Find the "Session Timeout (minutes)" input
2. Change value to `120` (2 hours)
3. Click outside the field or press Tab
4. Wait 2-3 seconds for auto-save
5. Wait for success toast
6. Refresh page
7. Verify value is `120`

**Expected:** Value updates and persists

### 1.5 Update Password Change Policy
**Steps:**
1. Find "Require Password Change (days)" input
2. Change to `60`
3. Tab out of field
4. Wait for success toast
5. Refresh page
6. Verify value is `60`

**Expected:** Value updates and persists

---

## Test 2: Security Notifications ✅

### 2.1 Test All Notification Toggles
**For each toggle:**
- New Login Detected
- Password Changes
- Profile Changes

**Steps:**
1. Toggle each one ON
2. Wait for success toast
3. Refresh page
4. Verify all are ON
5. Toggle each one OFF
6. Wait for success toast
7. Refresh page
8. Verify all are OFF

**Expected:** All toggles work independently and persist

---

## Test 3: IP Whitelist Management ✅

### 3.1 View Current IP
**Steps:**
1. Click "Add IP Address" button
2. In the dialog, you should see a box showing "Your Current IP"
3. Verify the IP address is displayed

**Expected:** Your current public IP is shown (e.g., `203.0.113.1`)

### 3.2 Add Current IP to Whitelist
**Steps:**
1. In the Add IP dialog, click "Use This IP" button
2. Verify the IP field is populated
3. Verify the label field shows "Current Location"
4. Click "Add IP Address" button
5. Wait for success toast: "IP address added to whitelist"
6. Dialog should close
7. Verify IP appears in the table below

**Expected:** 
- IP is added successfully
- Shows in table with label "Current Location"
- Status badge shows "Active" (green)

### 3.3 Add Custom IP Address
**Steps:**
1. Click "Add IP Address" button
2. Enter IP: `192.168.1.1`
3. Enter Label: `Home Router`
4. Click "Add IP Address"
5. Wait for success toast
6. Verify IP appears in table

**Expected:** IP added successfully

### 3.4 Add CIDR Range
**Steps:**
1. Click "Add IP Address"
2. Enter: `10.0.0.0/24`
3. Enter Label: `Office Network`
4. Click "Add IP Address"
5. Wait for success toast

**Expected:** CIDR range accepted and added

### 3.5 Test Invalid IP
**Steps:**
1. Click "Add IP Address"
2. Enter: `999.999.999.999`
3. Click "Add IP Address"
4. Should see error toast: "Invalid IP address format"

**Expected:** Invalid IP rejected with clear error

### 3.6 Remove IP from Whitelist
**Steps:**
1. Find an IP in the table
2. Click the trash icon on the right
3. Wait for success toast: "IP address removed from whitelist"
4. Verify IP disappears from table
5. Refresh page
6. Verify IP is still gone

**Expected:** IP removed permanently

### 3.7 Test Duplicate IP
**Steps:**
1. Add an IP (e.g., `192.168.1.100`)
2. Try to add the same IP again
3. Should update the existing entry (not create duplicate)

**Expected:** No duplicate IPs

---

## Test 4: IP Whitelist + Requirement Warning ⚠️

### 4.1 Test Warning Banner
**Steps:**
1. Enable "Require IP Whitelist" toggle
2. Remove ALL IPs from whitelist
3. You should see a yellow warning banner saying:
   - "IP Whitelist Required"
   - "You have enabled IP whitelist requirement but haven't added any IP addresses..."

**Expected:** Warning shows when whitelist is required but empty

### 4.2 Test Warning Disappears
**Steps:**
1. With warning showing, add any IP
2. Warning should disappear

**Expected:** Warning only shows when needed

---

## Test 5: Trusted Devices ✅

### 5.1 View Trusted Devices
**Steps:**
1. Scroll to "Trusted Devices" section
2. If you haven't used 2FA, table should show "No trusted devices"

**Expected:** Empty state shows when no devices

### 5.2 Revoke Device (If Available)
**Note:** This requires actual 2FA-authenticated devices

**Steps:**
1. If you have trusted devices in the table
2. Click trash icon next to a device
3. Wait for success toast: "Device trust revoked"
4. Device status should change to "Revoked" badge
5. Refresh page
6. Verify status is still "Revoked"

**Expected:** Device trust can be revoked

---

## Test 6: Error Handling ✅

### 6.1 Network Error Simulation
**Steps:**
1. Open DevTools → Network tab
2. Set to "Offline"
3. Try to toggle any preference
4. Should see error toast
5. Set back to "Online"
6. Try again - should work

**Expected:** Graceful error handling

### 6.2 Console Errors
**Steps:**
1. Check browser console
2. Should see NO red errors during normal use
3. You may see console.log messages (these are OK)

**Expected:** No console errors

---

## Test 7: Responsive Design 📱

### 7.1 Mobile View
**Steps:**
1. Open DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or similar
4. Test all features:
   - Toggles should work
   - Tables should scroll horizontally
   - Dialogs should fit screen
   - All text should be readable

**Expected:** Everything works on mobile

---

## Test 8: Data Persistence 🔄

### 8.1 Full Refresh Test
**Steps:**
1. Make several changes:
   - Enable 2FA requirement
   - Set session timeout to 240
   - Add 2 IP addresses
   - Enable all notifications
2. Close the browser tab completely
3. Open a new tab
4. Navigate to `/admin/security`
5. Verify ALL changes are preserved

**Expected:** All settings persist across sessions

### 8.2 Logout/Login Test
**Steps:**
1. Make changes to security settings
2. Log out of admin panel
3. Log back in
4. Navigate to Security page
5. Verify all settings are intact

**Expected:** Settings survive logout/login

---

## Test 9: Performance ⚡

### 9.1 Load Time
**Steps:**
1. Open Network tab in DevTools
2. Navigate to Security page
3. Check load time
4. Should load in < 2 seconds

**Expected:** Fast initial load

### 9.2 Update Speed
**Steps:**
1. Toggle a preference
2. Time from click to success toast
3. Should be < 1 second

**Expected:** Quick updates

---

## Common Issues & Solutions 🔧

### Issue: "Failed to update preferences"
**Solution:**
- Check browser console for errors
- Verify you're logged in as admin
- Try refreshing the page
- Check network tab for failed requests

### Issue: IP not being added
**Solution:**
- Verify IP format is valid
- Check for typos
- Try a different IP
- Check console for error details

### Issue: Toggles not saving
**Solution:**
- Wait 2-3 seconds after toggling
- Check for success toast
- Verify network connection
- Try refreshing page

### Issue: Warning banner not showing
**Solution:**
- Ensure IP whitelist requirement is enabled
- Verify ALL IPs are removed
- Refresh the page

---

## Success Criteria ✅

All tests should pass with:
- ✅ No console errors
- ✅ All toggles work
- ✅ All inputs save properly
- ✅ IP whitelist fully functional
- ✅ Warning banner shows when needed
- ✅ Data persists after refresh
- ✅ Success toasts appear
- ✅ Error handling works
- ✅ Mobile responsive

---

## Next Steps

After all tests pass:
1. Document any issues found
2. Report to development team
3. Confirm fixes
4. Move to Week 2 features

---

## Test Results Template

```
Date: ___________
Tester: __________

Test 1 (Security Preferences): ☐ Pass ☐ Fail
Test 2 (Notifications): ☐ Pass ☐ Fail
Test 3 (IP Whitelist): ☐ Pass ☐ Fail
Test 4 (Warning Banner): ☐ Pass ☐ Fail
Test 5 (Trusted Devices): ☐ Pass ☐ Fail
Test 6 (Error Handling): ☐ Pass ☐ Fail
Test 7 (Responsive): ☐ Pass ☐ Fail
Test 8 (Persistence): ☐ Pass ☐ Fail
Test 9 (Performance): ☐ Pass ☐ Fail

Overall: ☐ Pass ☐ Fail

Notes:
_________________________________
_________________________________
_________________________________
```

