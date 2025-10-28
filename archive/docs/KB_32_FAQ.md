# 7.4 Frequently Asked Questions (FAQ)

**Common questions and answers about Homara Gatekeeper**

---

## 📋 Table of Contents

- [General Questions](#general-questions)
- [Login & Access](#login--access)
- [User Management](#user-management)
- [Listings](#listings)
- [Verifications](#verifications)
- [Tasks & Workflows](#tasks--workflows)
- [Security](#security)
- [Reports & Analytics](#reports--analytics)
- [Technical Questions](#technical-questions)
- [Troubleshooting](#troubleshooting)

---

## General Questions

### Q: What is Homara Gatekeeper?
**A:** Homara Gatekeeper is an admin panel for managing a property rental platform. It handles user management, property listings, landlord verifications, analytics, and system security.

### Q: Who can access the admin panel?
**A:** Only authorized admins with accounts. There are three roles:
- **Super Admin** - Full access
- **Senior Admin** - Most features except system settings
- **Admin** - Basic administrative features

### Q: What browser should I use?
**A:** Modern browsers (2021+):
- ✅ Google Chrome (recommended)
- ✅ Mozilla Firefox
- ✅ Safari
- ✅ Microsoft Edge

Minimum: 1024px width screen

### Q: Is there a mobile app?
**A:** Not yet. The admin panel is web-based and optimized for desktop/tablet. Mobile support is limited.

### Q: How do I get an admin account?
**A:** Contact your Super Admin. Only Super Admins can create new admin accounts.

---

## Login & Access

### Q: I forgot my password. What do I do?
**A:** 
1. Click "Forgot Password" on login page
2. Enter your email
3. Check email for reset link
4. Click link and set new password
5. Login with new password

### Q: I can't login. What's wrong?
**A:** Check these:
- ✅ Correct email address
- ✅ Correct password (case-sensitive)
- ✅ Account not suspended
- ✅ 2FA code correct (if enabled)
- ✅ IP allowed (if whitelist enabled)
- ✅ Account not locked (after 5 failed attempts)

### Q: My account is locked. How do I unlock it?
**A:** 
- **Auto-unlock:** Wait 30 minutes after last failed attempt
- **Manual unlock:** Contact Super Admin to unlock immediately

### Q: What is 2FA and should I enable it?
**A:** 
Two-Factor Authentication adds extra security. After entering password, you need a 6-digit code from an authenticator app.

**Should you enable it?**
- ✅ **YES** if you're a Super Admin (highly recommended)
- ✅ **YES** if you handle sensitive data
- ✅ **YES** if you login from multiple locations
- ⚠️ Optional for basic admins

### Q: How long do I stay logged in?
**A:** Default: 24 hours. You can change this in Security Settings (15 min to 7 days).

### Q: Can I login from multiple devices?
**A:** Yes! You can be logged in on multiple devices simultaneously.

---

## User Management

### Q: What's the difference between Renters and Customers?
**A:**
- **Renters** - Looking for properties to rent
- **Customers** - May become renters, browsing properties
- **Landlords** - Property owners who list properties

(Same as Renters/Customers in functionality, distinction for analytics)

### Q: How do I find a specific user?
**A:** 
1. Go to Users page
2. Use search box (search by name, email, or phone)
3. Or use Advanced Filters for complex searches

### Q: Can I delete a user?
**A:** 
- **Admin:** No
- **Senior Admin:** No
- **Super Admin:** Yes (but not recommended - suspend instead)

### Q: What does "Trust Score" mean?
**A:** A calculated score (0-100) based on:
- Account age
- Verification status
- Activity level
- Reviews/ratings
- Flagged content

Higher = more trusted user.

### Q: How do I suspend a user?
**A:**
1. Open user details
2. Click "Suspend Account"
3. Select suspension reason
4. Add notes
5. Confirm

→ User can't login until activated again

---

## Listings

### Q: What happens when I approve a listing?
**A:** 
- Listing goes live on platform
- Visible to renters/customers
- Owner (landlord) notified
- Listed in "Active Listings"

### Q: What happens when I reject a listing?
**A:**
- Listing stays hidden
- Owner notified with rejection reason
- Can edit and resubmit
- Listed in "Rejected Listings"

### Q: Can I edit a listing?
**A:**
- **Admin:** No
- **Senior Admin:** No
- **Super Admin:** Yes

Normal flow: Reject and ask owner to edit.

### Q: What are common rejection reasons?
**A:**
- Inappropriate content
- Fake/suspicious listing
- Poor quality photos
- Misleading information
- Duplicate listing
- Incomplete information

### Q: How do I flag a listing?
**A:**
1. Open listing details
2. Click "Flag for Review"
3. Select flag reason
4. Add details
5. Senior Admin notified

### Q: Can a rejected listing be approved later?
**A:** Yes! If the owner edits and resubmits, you can review and approve.

---

## Verifications

### Q: What documents do landlords submit?
**A:**
1. **ID Document** - National ID, Passport, Driver's License
2. **Proof of Ownership** - Title Deed, Rental/Lease Agreement, Tax records

### Q: How do I know if documents are real?
**A:** Look for:
- ✅ Clear, readable text
- ✅ Official stamps/seals
- ✅ Consistent formatting
- ✅ Photo matches ID
- ✅ No signs of tampering
- ❌ Blurry/unclear images = reject
- ❌ Mismatched information = reject
- ❌ Obviously fake = reject & flag

### Q: What if I'm unsure about a verification?
**A:**
- **Option 1:** Reject and ask for clearer documents
- **Option 2:** Flag for Senior Admin review
- **Option 3:** Ask colleagues for second opinion

**When in doubt, reject!**

### Q: How long do I have to review a verification?
**A:** Default: 48 hours. After that, task escalates to Senior Admin.

### Q: Can I reassign a verification to someone else?
**A:** No. Only Super Admins can reassign. If you can't complete it, escalate.

### Q: What happens after I approve a verification?
**A:**
- Landlord marked as "Verified"
- Can now create property listings
- Receives email notification
- Trust score increases

---

## Tasks & Workflows

### Q: How are tasks assigned to me?
**A:** Automatically! When a new verification is submitted, the system assigns it to the admin with the least pending tasks (workload balancing).

### Q: Can I decline a task?
**A:** Not directly. If you can't complete it:
1. Add notes explaining why
2. Escalate to Senior Admin

### Q: What happens if I don't complete a task on time?
**A:**
- After 24 hours overdue, task escalates
- Senior Admin notified
- Shows as "Overdue" in your task list
- Affects performance metrics

### Q: How do I see all my tasks?
**A:** Click "My Tasks" in sidebar. Shows:
- Pending tasks
- In-progress tasks
- Completed tasks (today)
- Overdue tasks

### Q: Can I filter my tasks?
**A:** Yes! Filter by:
- Status (pending, in progress, completed)
- Priority (low, normal, high, urgent)
- Overdue only
- Due today/this week

---

## Security

### Q: Is my data secure?
**A:** Yes! Security measures include:
- ✅ HTTPS encryption
- ✅ Encrypted database
- ✅ Row Level Security (RLS)
- ✅ Regular backups
- ✅ 2FA available
- ✅ IP whitelisting
- ✅ Session timeout
- ✅ Complete audit logs

### Q: Can other admins see my password?
**A:** No! Passwords are hashed and cannot be viewed by anyone, including Super Admins.

### Q: What is IP whitelisting?
**A:** Only allows login from specific IP addresses you've approved. Useful if you always work from same locations (office, home).

**Example:**
- Add home IP: 192.168.1.100
- Add office IP: 203.0.113.50
- Enable IP whitelist
- → Can only login from those IPs

### Q: Should I use IP whitelist?
**A:**
- ✅ **YES** if you work from fixed locations
- ❌ **NO** if you travel or work remotely
- ⚠️ Be careful not to lock yourself out!

### Q: How do I know if someone accessed my account?
**A:**
- Check "Last Login" in your profile
- Review activity log
- Enable login notifications (future)
- Check trusted devices list

### Q: What if I suspect my account is compromised?
**A:**
1. Change password immediately
2. Enable 2FA
3. Revoke all trusted devices
4. Contact Super Admin
5. Review activity log
6. Report suspicious activity

---

## Reports & Analytics

### Q: What reports can I generate?
**A:**
- User statistics report
- Listing performance report
- Verification processing report
- Revenue report
- Custom reports (Report Builder)

### Q: Can I schedule reports to run automatically?
**A:** Yes! Go to Reports → New Schedule, set:
- Report type
- Frequency (daily, weekly, monthly)
- Email recipients
- Format (CSV, JSON)

### Q: How do I export data?
**A:**
1. Go to any list view (Users, Listings, etc.)
2. Apply filters (optional)
3. Click "Export" button
4. Choose format (CSV or JSON)
5. Click "Download"

### Q: What's the difference between Reports and Analytics?
**A:**
- **Analytics** - Visual charts and graphs
- **Reports** - Tabular data you can export

Both show the same underlying data, different presentations.

### Q: How often does analytics data update?
**A:** 
- Real-time metrics: Every 30 seconds
- Charts: Cached for 5 minutes
- Historical data: Updated daily

---

## Technical Questions

### Q: What happens if my internet disconnects?
**A:**
- Current changes may be lost
- Refresh page when reconnected
- Unsaved data lost
- Auto-save coming in future updates

### Q: Why is the page loading slowly?
**A:** Possible reasons:
- Slow internet connection
- Large dataset (thousands of records)
- Server maintenance
- Browser cache full

**Solutions:**
- Use filters to reduce data
- Clear browser cache
- Try different browser
- Contact support if persists

### Q: Can I use keyboard shortcuts?
**A:** Yes! Common ones:
- `Ctrl + K` - Global search
- `Ctrl + F` - Find on page
- `Esc` - Close modals
- `Tab` - Navigate forms

### Q: Does the system support multiple languages?
**A:** Not yet. Currently English only. Multi-language support planned for future.

### Q: Can I integrate with other systems?
**A:** Not currently. API access for third-party integrations is planned for future updates.

---

## Troubleshooting

### Q: I don't see any data. Why?
**A:**
1. Check if filters are applied (clear filters)
2. Check your permissions (some data restricted by role)
3. Check internet connection
4. Try refreshing page (F5)
5. Try different browser

### Q: Export button is disabled. Why?
**A:**
- No data selected (select at least one item)
- No data available to export
- You don't have export permission (unlikely)

### Q: I can't approve a verification. Why?
**A:**
- Verification already processed
- Not assigned to you
- You don't have permission
- System error (check error message)

### Q: Bulk operation failed. What happened?
**A:**
- Some items may have succeeded
- Check result summary
- Items that failed show error message
- Common causes:
  - Permission denied on some items
  - Items already processed
  - Validation errors

### Q: Page says "Unauthorized". What does this mean?
**A:**
- You don't have permission for that action
- Your session expired (login again)
- Your role changed (contact Super Admin)

### Q: I see "Error 500". What do I do?
**A:**
1. Refresh the page
2. Try again
3. If persists, note:
   - What you were doing
   - Error message
   - Screenshot
4. Report to Super Admin/support

---

## Still Have Questions?

### 📖 Check these resources:
- [Troubleshooting Guide](./KB_19_TROUBLESHOOTING.md)
- [Admin User Guide](./KB_16_ADMIN_GUIDE.md)
- [Super Admin Guide](./KB_17_SUPER_ADMIN_GUIDE.md)
- [Complete Features Guide](./KB_COMPLETE_FEATURES_GUIDE.md)

### 🆘 Get Help:
- **Email:** support@yourdomain.com
- **Slack:** #admin-support
- **Documentation:** /docs
- **Escalate:** Contact Senior Admin or Super Admin

---

**Can't find your answer? Submit a question and we'll add it to the FAQ!** 📝

