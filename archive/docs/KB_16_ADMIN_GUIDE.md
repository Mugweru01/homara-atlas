# 4.1 Admin User Guide

**Complete guide for Admin role users**

---

## 👋 Welcome, Admin!

This guide will help you make the most of the Homara Gatekeeper admin panel as an **Admin** user.

---

## 🎯 Your Role & Permissions

### As an Admin, you can:
✅ View and manage users  
✅ View and manage listings  
✅ Process verification requests  
✅ Complete assigned tasks  
✅ Use bulk operations  
✅ Create and save filters  
✅ Export data  
✅ Generate reports  
✅ View analytics  
✅ Customize your dashboard  
✅ Manage your security settings  

### You cannot:
❌ Manage other admins  
❌ Access Security Center  
❌ Access System Monitoring  
❌ Configure backups  
❌ View performance metrics  
❌ Modify system settings  

---

## 🚀 Getting Started

### 1. First Login

**Access the admin panel:**
1. Go to `yourdomain.com/admin/login`
2. Enter your email and password
3. Complete 2FA if enabled
4. You'll land on the Dashboard

**Initial Setup:**
1. Update your profile (click your name → Profile)
2. Set up 2FA (Security Settings → Enable 2FA)
3. Configure session timeout (Security Settings)
4. Customize your dashboard (Customize Dashboard)

### 2. Dashboard Overview

**Your dashboard shows:**
- **User Statistics** - Total users, new today
- **Listing Statistics** - Total listings, new listings
- **Pending Verifications** - Verifications needing review
- **Flagged Content** - Content requiring moderation
- **Quick Actions** - Shortcuts to common tasks
- **My Tasks** - Your assigned tasks

**Quick Actions:**
- View All Users
- View All Listings
- Process Verifications
- My Tasks
- Generate Report

---

## 📋 Daily Tasks

### Morning Routine:
1. Check **Dashboard** for new notifications
2. Review **My Tasks** for pending assignments
3. Check **Pending Verifications** count
4. Review **Flagged Content** (if any)

### Throughout the Day:
1. Process assigned verifications
2. Respond to user issues
3. Monitor new listings
4. Update task status

### End of Day:
1. Complete in-progress tasks
2. Add notes to pending items
3. Review tomorrow's priorities

---

## 👥 Managing Users

### View All Users:
1. Click **Users** in sidebar
2. See list of all platform users
3. Use filters to find specific users

### User List Columns:
- Name
- Email
- Role (Renter, Customer, Landlord)
- Trust Score
- Verification Status
- Joined Date

### Filter Users:
```
Click "Filters" button
→ Select filter type (Role, Status, etc.)
→ Enter criteria
→ Click "Apply"
```

### View User Details:
```
Click on user row
→ Opens detail modal
→ Shows full profile
→ Activity history
→ Properties (if landlord)
```

### User Actions:
- **View Profile** - Full user information
- **Activity Log** - User's activity history
- **Suspend** (if authorized)
- **Activate** (if authorized)
- **Export Data** - Export user information

### Search Users:
```
Use search box at top
→ Search by name, email, or phone
→ Results filter in real-time
```

---

## 🏠 Managing Listings

### View All Listings:
1. Click **Listings** in sidebar
2. Browse property listings
3. Filter by status, price, location

### Listing Table Columns:
- Property Title
- Owner Name
- Location (County, Town)
- Price (Ksh)
- Bedrooms/Bathrooms
- Status
- Created Date

### Filter Listings:
**Common Filters:**
- Status (Pending, Approved, Rejected)
- Price Range (e.g., 10,000 - 50,000 Ksh)
- Location (County, Town)
- Property Type
- Bedrooms/Bathrooms count

**How to Filter:**
```
1. Click "Advanced Filters"
2. Add filter criteria
3. Click "Apply Filters"
4. Results update automatically
```

### View Listing Details:
```
Click listing row
→ Opens detail view
→ View all photos
→ See full description
→ Check amenities
→ Review owner info
```

### Listing Actions:
- **Approve Listing** - Make it live
- **Reject Listing** - With rejection reason
- **Flag for Review** - Escalate to senior admin
- **View Activity** - Listing history

### Approve a Listing:
```
1. Open listing details
2. Review all information
3. Check photos are appropriate
4. Click "Approve"
5. Add notes (optional)
6. Confirm
```

### Reject a Listing:
```
1. Open listing details
2. Click "Reject"
3. Select rejection reason:
   - Inappropriate content
   - Fake listing
   - Poor quality photos
   - Missing information
   - Other (specify)
4. Add detailed notes
5. Confirm rejection
```

---

## ✅ Processing Verifications

### What are Verifications?
Landlords submit verification requests to prove they own properties. You review their documents and approve or reject.

### Access Verifications:
1. Click **Verifications** in sidebar
2. See all verification requests
3. Focus on those assigned to you

### Verification Table:
- Landlord Name
- Email
- Submission Date
- Status (Pending, Approved, Rejected)
- Assigned Admin

### Review a Verification:

**Step 1: Open Request**
```
Click on verification row
→ Opens detail view
```

**Step 2: Review Documents**
```
- ID Document (National ID, Passport)
- Proof of Ownership (Title Deed, Rental Agreement)
- Click thumbnails to view full size
- Zoom in to verify details
```

**Step 3: Verify Authenticity**
- Check ID photo matches submitted photo
- Verify ID number format is valid
- Check ownership document looks legitimate
- Look for signs of forgery (poor quality, misaligned text)

**Step 4: Make Decision**

**To Approve:**
```
1. Click "Approve"
2. Add verification notes (optional)
3. Confirm approval
→ Landlord can now list properties
→ Email sent to landlord
→ Task marked complete
```

**To Reject:**
```
1. Click "Reject"
2. Select rejection reason:
   - Documents unclear/unreadable
   - ID doesn't match
   - Ownership proof insufficient
   - Suspected fraud
   - Other (specify)
3. Add detailed explanation
4. Confirm rejection
→ Landlord notified
→ Can resubmit with better documents
```

### Verification Best Practices:
✅ Take time to review carefully  
✅ Zoom in on documents  
✅ Check for inconsistencies  
✅ When in doubt, reject and ask for clarification  
✅ Add clear notes for your records  
✅ If very suspicious, flag for senior admin  

---

## 📝 My Tasks

### What are Tasks?
Tasks are assignments given to you (usually verification requests). The system auto-assigns based on workload.

### Access My Tasks:
1. Click **My Tasks** in sidebar
2. See all your assignments
3. Review statistics

### Task Dashboard Shows:
- Total Pending
- In Progress
- Completed Today
- Overdue
- High Priority

### Task List Columns:
- Task Type
- Entity (what needs action)
- Priority (Low, Normal, High, Urgent)
- Due Date
- Status

### Filter Tasks:
- By Status (Pending, In Progress, Completed)
- By Priority
- Overdue Only
- Due Today

### Complete a Task:

**Step 1: Start Task**
```
1. Click task row
2. Opens related entity (e.g., verification)
3. Task status changes to "In Progress"
```

**Step 2: Perform Action**
```
- Review the content
- Make your decision
- Take required action (approve, reject, etc.)
```

**Step 3: Mark Complete**
```
1. After taking action, task auto-completes
OR
1. Click "Complete Task"
2. Add completion notes
3. Confirm
→ Task marked complete
→ Removed from pending list
```

### Overdue Tasks:
- Tasks overdue by 24 hours escalate to senior admin
- Try to complete tasks before due date
- If stuck, add notes explaining delay

---

## 🔄 Bulk Operations

### What are Bulk Operations?
Process multiple items at once instead of one by one.

### Bulk Operations Available:
- Bulk Approve Listings
- Bulk Reject Listings
- Bulk Export
- Bulk Suspend Users (if authorized)

### How to Use:

**Step 1: Select Items**
```
☐ Item 1
☐ Item 2
☐ Item 3
OR
☑ Select All (page)
```

**Step 2: Choose Action**
```
Bulk Actions dropdown appears
→ Select operation
→ Bulk Approve
→ Bulk Reject
→ Bulk Export
```

**Step 3: Provide Details**
```
If Reject:
→ Select reason
→ Add notes

If Approve:
→ Add notes (optional)
```

**Step 4: Confirm**
```
Review summary
→ X items will be processed
→ Click "Confirm"
→ Progress bar shows status
→ Summary shows results
```

### Tips:
✅ Use filters first to narrow selection  
✅ Review selection before confirming  
✅ Max 100 items per operation  
✅ Bulk operations can't be undone easily  

---

## 🔍 Advanced Filtering

### What is Advanced Filtering?
Create complex filters to find exactly what you need.

### How to Use:

**Step 1: Click "Advanced Filters"**
```
Opens filter builder
```

**Step 2: Add Criteria**
```
Field: Status
Operator: Equals
Value: Pending

➕ Add another condition

Field: Price
Operator: Greater than
Value: 30000
```

**Step 3: Apply**
```
Click "Apply Filters"
→ Results update
→ Only matching items shown
```

### Save Filters:

**Why Save?**
Reuse filters you use often instead of rebuilding.

**How to Save:**
```
1. Build your filter
2. Click "Save Filter"
3. Enter name: "High-value pending"
4. Choose visibility:
   - Private (only you)
   - Public (all admins)
5. Click "Save"
```

**How to Load:**
```
1. Click "Saved Filters"
2. Select filter from list
3. Filter applied instantly
```

---

## 📊 Export & Reports

### Export Data:

**Export Current View:**
```
1. Apply any filters (optional)
2. Click "Export" button
3. Choose format:
   - CSV (Excel)
   - JSON
4. Click "Download"
→ File downloads
```

**What's Included:**
- All visible columns
- All rows (respects filters)
- Up to 10,000 records
- Formatted currency (Ksh)

### Generate Reports:

**Quick Report:**
```
1. Go to Reports page
2. Click "Generate Report"
3. Select report type
4. Choose date range
5. Click "Generate"
→ Report created
→ Download or view online
```

**Scheduled Reports:**
```
1. Go to Reports page
2. Click "New Schedule"
3. Configure:
   - Report name
   - Frequency (daily, weekly, monthly)
   - Email recipients
   - Format (CSV, JSON)
4. Click "Create Schedule"
→ Reports generated automatically
→ Emailed to recipients
```

---

## 📈 Analytics

### Access Analytics:
1. Click **Analytics** in sidebar
2. Choose tab:
   - Overview
   - Users
   - Listings

### Overview Tab:
**Metrics:**
- Total Users
- Total Listings
- Total Revenue
- Average Listing Price

**Charts:**
- User Growth (line chart)
- Listing Growth (area chart)
- Revenue Trend

### Users Tab:
**Charts:**
- User Growth Rate
- User Role Distribution (pie)
- Trust Score Distribution (bar)

### Listings Tab:
**Charts:**
- Listings by Status
- Listings by County
- Price Distribution
- Top Performing Listings

### Interact with Charts:
- Hover for exact values
- Click legend to hide/show series
- Change date range (top right)
- Export chart as image (future)

---

## 🔒 Security Settings

### Access Security Settings:
1. Click your name (top right)
2. Select "Security Settings"

### Enable 2FA:

**Step 1: Get Authenticator App**
```
Download on phone:
- Google Authenticator
- Microsoft Authenticator
- Authy
```

**Step 2: Enable in Settings**
```
1. Toggle "Enable 2FA"
2. Scan QR code with app
3. Enter 6-digit code
4. Save backup codes
5. Click "Confirm"
→ 2FA now required for login
```

### IP Whitelisting:

**View Your Current IP:**
```
Displayed at top of page
→ "Your IP: 192.168.1.1"
```

**Add IP to Whitelist:**
```
1. Click "Add IP"
2. IP auto-filled (or enter manually)
3. Add description: "Home", "Office", etc.
4. Click "Add"
→ IP whitelisted
```

**Enable IP Whitelist:**
```
Toggle "IP Whitelist Enabled"
→ Only whitelisted IPs can login
→ Blocks access from unknown IPs
```

**⚠️ Warning:**
Adding IP whitelist without adding your current IP will lock you out!

### Session Timeout:
```
Default: 24 hours
→ Change to: 15 min, 1 hour, 4 hours, 7 days
→ Click "Save"
→ Next login uses new timeout
```

---

## 🎨 Customize Dashboard

### Access Customization:
1. Click **Customize Dashboard** in sidebar

### Customize Widgets:

**Hide/Show Widgets:**
```
☐ User Statistics    (hide)
☑ Listing Statistics (show)
☑ My Tasks          (show)
☐ Quick Actions      (hide)
```

**Reorder Widgets:**
```
Drag widgets up/down
→ Changes order on dashboard
→ See preview in real-time
```

**Save Layout:**
```
Click "Save Layout"
→ Applied immediately
→ Dashboard updates
→ Layout saved to database
```

**Reset to Default:**
```
Click "Reset to Default"
→ Restores factory layout
→ All widgets visible
→ Default order
```

---

## 💡 Tips & Tricks

### Keyboard Shortcuts:
- `Ctrl + K` - Global search
- `Ctrl + F` - Find on page
- `Esc` - Close modals
- `Tab` - Navigate forms

### Efficiency Tips:
✅ Use saved filters for common searches  
✅ Enable 2FA for security  
✅ Customize dashboard to show what matters  
✅ Use bulk operations for repetitive tasks  
✅ Set session timeout based on work style  
✅ Review tasks daily to avoid overdue  
✅ Add notes to all actions for audit trail  

### Common Mistakes to Avoid:
❌ Approving without reviewing documents  
❌ Rejecting without clear reason  
❌ Forgetting to complete tasks  
❌ Not using filters (slower workflow)  
❌ Processing items individually when bulk available  

---

## 🆘 Need Help?

### Common Issues:
- [Troubleshooting Guide](./KB_19_TROUBLESHOOTING.md)
- [FAQ](./KB_32_FAQ.md)
- [Error Codes](./KB_31_ERROR_CODES.md)

### Contact Support:
- Email: support@yourdomain.com
- Slack: #admin-support
- Senior Admin escalation

---

**Happy Administering!** 🎉

---

## 📖 Related Documentation

- [System Overview](./KB_01_SYSTEM_OVERVIEW.md)
- [Complete Features Guide](./KB_COMPLETE_FEATURES_GUIDE.md)
- [Super Admin Guide](./KB_17_SUPER_ADMIN_GUIDE.md)
- [Troubleshooting](./KB_19_TROUBLESHOOTING.md)

