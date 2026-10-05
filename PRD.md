# AutoLead — Used Car Sales, Inventory & Lead Management Platform

## Product Requirements Document (PRD)

**Version:** 3.0
**Status:** Draft
**Last Updated:** September 2026
**Audience:** Product, Engineering, Design, Sales Operations, Management

---

# 1. Executive Summary

AutoLead is a unified platform for managing the complete operations of a used-car sales and brokering business.

The platform connects four major participants:

* Admin
* Salesperson
* Car Owner
* Buyer

AutoLead manages the lifecycle of a vehicle from the moment an owner submits or brings a vehicle to the business through:

* Vehicle registration
* Inspection
* Inventory management
* Public listing
* Buyer discovery
* Buyer inquiry
* Internal lead creation
* Salesperson follow-up
* Negotiation
* Sale
* Financial and profitability tracking

The platform includes both internal business tools and external portals.

However, the external Buyer Portal is strictly a **vehicle discovery and customer acquisition portal**. Buyer inquiries become internal leads managed by the brokerage. Buyers must not have access to the internal lead-management process.

The core business model is:

```text
Car Owner
    ↓
Vehicle Submitted
    ↓
Vehicle Managed by Brokerage
    ↓
Vehicle Listed
    ↓
Buyer Discovers Vehicle
    ↓
Buyer Shows Interest
    ↓
Internal Lead Created
    ↓
Salesperson Manages Relationship
    ↓
Negotiation
    ↓
Sale
```

The brokerage remains the intermediary throughout the sales process.

---

# 2. Problem Statement

Used-car businesses often operate using fragmented systems such as:

* Phone calls
* WhatsApp
* Excel sheets
* Physical notebooks
* Individual salesperson records
* Social media
* Classified listings

This creates several operational problems:

* Buyer leads can be lost.
* Follow-ups are inconsistent.
* Vehicle information is scattered.
* Owners repeatedly contact the business for updates.
* Salesperson performance is difficult to measure.
* Vehicle expenses are not accurately tracked.
* The business cannot easily calculate profit per vehicle.
* Buyers have no centralized marketplace to browse inventory.
* Management lacks visibility into the complete business lifecycle.

AutoLead should centralize these operations into a single connected platform.

---

# 3. Product Vision

The vision of AutoLead is to become the central operating system for a used-car sales and brokering company.

Every important business entity should be connected:

```text
Owner
  ↓
Vehicle
  ↓
Inventory
  ↓
Buyer Interest
  ↓
Lead
  ↓
Salesperson
  ↓
Follow-up
  ↓
Negotiation
  ↓
Sale
  ↓
Revenue
  ↓
Profit
```

The business should be able to trace every vehicle and transaction from beginning to end.

For every vehicle, the system should answer:

* Who owns or supplied the vehicle?
* How did the vehicle enter the business?
* What type of acquisition is it?
* What expenses were incurred?
* How many buyers showed interest?
* How many leads were created?
* Which salesperson managed the leads?
* How long did it take to sell?
* What was the selling price?
* What profit did the business make?

---

# 4. Product Goals

The platform should:

1. Manage car owners and their vehicles.
2. Allow owners to access their own vehicles through an Owner Portal.
3. Manage used-car inventory.
4. Provide a public marketplace for buyers.
5. Allow buyers to create accounts and manage their preferences and saved vehicles.
6. Convert buyer interest into internal sales leads.
7. Prevent buyers from accessing internal lead information.
8. Help salespeople manage follow-ups and negotiations.
9. Track vehicle-level expenses and revenue.
10. Track overall business income and expenses.
11. Calculate profit and loss.
12. Provide management with dashboards and reports.

---

# 5. User Roles

The platform will have four primary user roles.

## 5.1 Admin

The Admin has complete operational control over the business.

### Responsibilities

* Manage users.
* Manage salespeople.
* Manage owners.
* Manage vehicles.
* Manage inventory.
* View and manage all leads.
* Assign and reassign leads.
* Manage finance.
* View reports.
* Configure business settings.
* Configure showroom information.
* Manage vehicle listings.

---

## 5.2 Salesperson

The salesperson manages vehicle intake and buyer relationships.

### Responsibilities

* Register owners.
* Add vehicles.
* Upload vehicle images.
* Upload documents.
* Create leads.
* Manage assigned leads.
* Contact buyers.
* Schedule follow-ups.
* Update lead status.
* Add notes.
* Handle negotiations.
* Manage buyer inquiries.
* Assist with test-drive requests.
* Update sales outcomes.

---

## 5.3 Car Owner

A Car Owner is a person who wants to sell or list their vehicle through the company.

The owner has access to an Owner Portal.

### Capabilities

* Manage profile.
* Submit a vehicle.
* View submitted vehicles.
* View vehicle status.
* View vehicle listing status.
* Upload vehicle images.
* Provide additional vehicle information.
* Request vehicle removal.
* Contact the brokerage.

Owners only have access to their own information and vehicles.

---

## 5.4 Buyer

A Buyer is a potential customer interested in purchasing a vehicle.

The buyer can browse the public marketplace and optionally have a Buyer Account.

### Capabilities

* Browse vehicles.
* Search and filter inventory.
* View vehicle details.
* Save favourite vehicles.
* Manage vehicle preferences.
* View recently viewed vehicles.
* Submit an inquiry.
* Request a callback.
* Request a test drive.
* Call the showroom.
* Get showroom directions.

A buyer must not have access to internal lead information.

---

# 6. Permissions

| Capability              | Admin    | Salesperson               | Owner             | Buyer |
| ----------------------- | -------- | ------------------------- | ----------------- | ----- |
| Manage all vehicles     | Yes      | Yes, based on permissions | Own vehicles only | No    |
| View public vehicles    | Yes      | Yes                       | Yes               | Yes   |
| Manage owners           | Yes      | Yes                       | Own profile only  | No    |
| Manage leads            | Yes      | Assigned leads            | No                | No    |
| View lead status        | Yes      | Assigned leads            | No                | No    |
| View internal notes     | Yes      | Assigned leads            | No                | No    |
| Assign leads            | Yes      | No                        | No                | No    |
| Manage finance          | Yes      | Configurable              | No                | No    |
| Submit vehicle          | Yes      | Yes                       | Yes               | No    |
| Submit vehicle inquiry  | No       | On behalf of buyer        | No                | Yes   |
| Save favourite vehicles | Optional | Optional                  | No                | Yes   |
| View reports            | Yes      | Own performance           | No                | No    |

---

# 7. Owner Management

The business should maintain a central record for every car owner.

## 7.1 Owner Information

Required fields:

```text
Name
Phone Number
Email
Address
City
Preferred Contact Method
```

Optional fields:

```text
Alternative Phone Number
Identification Information
Notes
```

A phone number should be used as a primary duplicate-detection mechanism.

One owner can have multiple vehicles.

The owner profile should display complete vehicle history.

---

# 8. Owner Portal

The Owner Portal gives owners visibility into their vehicles while keeping internal business operations private.

---

## 8.1 Owner Registration

Owners should be able to register and create an account.

Registration can be completed through:

```text
Phone Number
Email
Password / OTP Authentication
```

---

## 8.2 Submit a Vehicle

An owner should be able to submit a vehicle for sale or listing.

Required information:

```text
Make
Model
Variant
Year
Registration Number
Fuel Type
Transmission
Kilometers Driven
Number of Previous Owners
Colour
Expected Price
Location
```

Optional information:

```text
Description
Service History
Accident History
Insurance Details
Loan Status
```

The owner can upload initial vehicle photos.

---

## 8.3 Vehicle Submission Flow

```text
Owner
  ↓
Login
  ↓
Submit Vehicle
  ↓
Enter Vehicle Details
  ↓
Upload Photos
  ↓
Submit
  ↓
Vehicle Created
  ↓
Salesperson / Admin Review
  ↓
Inspection
  ↓
Approved / Rejected
```

---

## 8.4 Owner Dashboard

The Owner Dashboard should display:

```text
Total Submitted Vehicles

Under Inspection

Available for Sale

Reserved

Sold
```

The owner should also see all vehicles associated with their account.

---

## 8.5 Owner Vehicle Status

Vehicle statuses visible to owners:

```text
Submitted
    ↓
Inspection Pending
    ↓
Under Inspection
    ↓
Approved
    ↓
Available for Sale
    ↓
Reserved
    ↓
Sold
```

Alternative statuses:

```text
Rejected

On Hold

Removed
```

---

## 8.6 Owner Vehicle Management

Owners should be able to:

* View their vehicle.
* View the current status.
* Edit permitted vehicle details.
* Upload additional images.
* Provide requested information.
* Request vehicle removal.
* Contact the brokerage.

Owners should not automatically see:

* Internal business expenses.
* Dealership margins.
* Internal salesperson notes.
* Buyer identities.
* Internal negotiations.
* Internal lead information.

---

# 9. Vehicle Inventory Management

Vehicles are the central entity of the AutoLead platform.

Every vehicle should connect:

```text
Owner
↓
Vehicle
↓
Inventory
↓
Buyer Interest
↓
Leads
↓
Salesperson
↓
Sale
↓
Finance
```

---

## 9.1 Vehicle Details

Each vehicle should contain:

```text
Make
Model
Variant
Year
Registration Number
Fuel Type
Transmission
Kilometers Driven
Number of Owners
Colour
Insurance Validity
RC Status
Service History
Accident History
Loan Status
Location
```

---

## 9.2 Acquisition Type

Each vehicle must have an acquisition type.

Supported types:

```text
Dealership Purchase

Consignment

Intermediary Sale
```

This is required because finance calculations differ depending on the business relationship with the vehicle owner.

---

## 9.3 Commercial Details

```text
Owner Expected Price

Company Purchase Price

Expected Selling Price

Minimum Selling Price

Commission

Other Costs
```

---

## 9.4 Vehicle Media

Multiple images should be supported.

Recommended categories:

```text
Front

Rear

Left Side

Right Side

Interior

Dashboard

Engine

Tyres

Additional Images
```

---

## 9.5 Vehicle Documents

Authorized users can upload:

```text
RC

Insurance

Service Records

Loan Clearance Documents

Inspection Reports
```

Sensitive documents must never be visible in the public marketplace.

---

# 10. Vehicle Lifecycle

> **Superseded for the MVP by [ADR-0011](docs/adr/0011-vehicle-lead-status-lifecycle.md):** only admins add vehicles, and vehicle statuses are `open`, `linked`, `dropped`, `sold`, driven by their leads. The original lifecycle is kept below for reference.

The vehicle lifecycle should be:

```text
Owner Submitted
      ↓
Inspection Pending
      ↓
Under Inspection
      ↓
Approved
      ↓
Available for Sale
      ↓
Reserved
      ↓
Sold
```

Alternative statuses:

```text
Rejected

On Hold

Removed
```

If a sale falls through:

```text
Reserved
   ↓
Available for Sale
```

This status transition should be recorded.

Only vehicles marked:

```text
Available for Sale
```

should be publicly visible.

---

# 11. Public Vehicle Marketplace

The public marketplace is the primary customer acquisition channel.

Buyers should be able to browse vehicles without creating an account.

Creating an account should be optional until account-specific functionality is required.

---

## 11.1 Vehicle Listing Card

Each vehicle listing should display:

```text
Vehicle Image

Make and Model

Year

Kilometers Driven

Fuel Type

Transmission

Selling Price

Location
```

---

## 11.2 Search

Buyers should be able to search by:

```text
Brand

Model

Keyword
```

---

## 11.3 Filters

MVP filters:

```text
Brand

Model

Price Range

Year

Fuel Type

Transmission

Kilometers

Location
```

Future filters:

```text
Number of Owners

Colour

Body Type

EMI Range
```

---

# 12. Vehicle Detail Page

Each vehicle detail page should contain:

## Vehicle Details

```text
Make

Model

Variant

Year

Registration Year

Fuel Type

Transmission

Kilometers

Colour

Number of Previous Owners
```

## Pricing

```text
Selling Price
```

## Media

```text
Vehicle Image Gallery
```

## Buyer Actions

```text
Inquire

Request Callback

Request Test Drive

Call Showroom

Get Directions

Save Vehicle
```

---

# 13. Buyer Portal

The Buyer Portal is a customer engagement and vehicle discovery portal.

It is not a lead-management portal.

The Buyer Portal must not expose the internal brokerage sales process.

---

# 14. Buyer Registration

Buyers can create accounts using:

```text
Name

Phone Number

Email
```

Optional profile information:

```text
Location

Preferred Contact Method

Budget

Preferred Brands

Preferred Fuel Type

Preferred Transmission
```

Buyer preferences should primarily be used to improve vehicle discovery and future recommendations.

---

# 15. Buyer Dashboard

The Buyer Dashboard should display:

```text
Saved Vehicles

Recently Viewed Vehicles

Vehicle Preferences
```

Future capabilities may include:

```text
Recommended Vehicles

Price Drop Alerts

New Vehicles Matching Preferences
```

---

# 16. Saved Vehicles

Buyers should be able to save vehicles they are interested in.

Example:

```text
Saved Vehicles

Hyundai Creta

Kia Seltos

Honda City
```

Saved vehicles can be used internally as an indication of buyer interest.

However, saved vehicles should not automatically expose the buyer's internal lead profile or sales information to the buyer.

---

# 17. Buyer Inquiry

Buyers should be able to express interest through:

```text
Inquire

Request Callback

Request Test Drive

Call Showroom
```

The inquiry flow should be:

```text
Buyer Action
      ↓
Buyer Identified
      ↓
Lead Created or Existing Lead Updated
      ↓
Lead Assigned to Salesperson
      ↓
Salesperson Contacts Buyer
```

---

# 18. Buyer Restrictions

The Buyer Portal must not display:

```text
Lead Status

Inquiry Pipeline

Salesperson Assignment

Follow-up Status

Follow-up History

Internal Notes

Lead Score

Negotiation Progress

Internal Offers

Internal CRM History

Salesperson Performance Information
```

The buyer should not be able to track the brokerage's internal lead-management workflow.

This is important because the lead is an internal sales asset managed by the brokerage.

---

# 19. Buyer and Lead Data Model Principle

A Buyer and a Lead are separate entities.

## Buyer

A Buyer represents a person.

```text
Buyer

Name
Phone Number
Email
Preferences
Saved Vehicles
```

## Lead

A Lead represents an internal sales opportunity.

```text
Lead

Buyer
Interested Vehicle
Lead Source
Assigned Salesperson
Lead Status
Follow-ups
Notes
Negotiation
Outcome
```

One buyer may have multiple leads.

Example:

```text
Buyer: Rahul

Lead 1
Vehicle: Hyundai Creta
Outcome: Lost

Lead 2
Vehicle: Kia Seltos
Status: Negotiation

Lead 3
Vehicle: Honda City
Outcome: Sold
```

The Buyer Portal should not expose this internal structure.

---

# 20. Lead Management

Lead Management is available only to Admin and authorized Salesperson users.

---

## 20.1 Lead Sources

The system should track:

```text
Public Marketplace

Mobile App

Website

Phone Call

Walk-in

WhatsApp

Instagram

Facebook

Referral

Other
```

---

## 20.2 Lead Information

Each lead should contain:

```text
Buyer Name

Phone Number

Email

Interested Vehicle

Inquiry Source

Assigned Salesperson

Lead Status

Notes

Budget

Preferred Car

Purchase Timeline

Finance Requirement

Current Vehicle

Trade-in Requirement
```

---

## 20.3 Manual Lead Entry

A salesperson should be able to manually create a lead.

Example:

```text
Buyer calls showroom
       ↓
Salesperson identifies potential buyer
       ↓
Salesperson creates lead
```

Minimum required information:

```text
Buyer Name

Phone Number

Interested Vehicle
```

---

# 21. Lead Lifecycle

> **Superseded for the MVP by [ADR-0011](docs/adr/0011-vehicle-lead-status-lifecycle.md):** lead statuses are `new`, `not_now`, `booking_confirmed`, `converted`, `lost`, `vehicle_unavailable`. The original lifecycle is kept below for reference.

The internal lead lifecycle should be:

```text
New Lead
    ↓
Contacted
    ↓
Interested
    ↓
Follow-up
    ↓
Test Drive Requested
    ↓
Negotiation
    ↓
Booking Confirmed
    ↓
Sold
```

Alternative outcomes:

```text
Lost

Not Interested

No Response
```

Lost leads should remain available for future reactivation.

---

# 22. Lead Assignment

For the initial version:

* Admin manually assigns leads.
* Admin can reassign leads.
* Salespersons can view only assigned leads.
* Admin can view salesperson workload.

Future:

```text
Automatic Lead Assignment

Round Robin

Availability-Based Assignment
```

---

# 23. Follow-up Management

Salespeople should be able to create follow-up tasks.

Each follow-up should contain:

```text
Lead

Date

Time

Task Type

Notes
```

Task types:

```text
Call

WhatsApp

Meeting

Test Drive

Send Quotation

Other
```

The Salesperson Dashboard should display:

```text
Today's Follow-ups

Overdue Follow-ups

Upcoming Follow-ups
```

---

# 24. Test Drive Requests

For the initial product version, buyers can request a test drive.

Flow:

```text
Buyer Requests Test Drive
       ↓
Internal Lead Created or Updated
       ↓
Salesperson Handles Request
```

The buyer should not see internal scheduling or lead status.

Future versions can include:

```text
Date Selection

Time Slot Selection

Test Drive Confirmation
```

---

# 25. Salesperson Dashboard

The salesperson dashboard should provide a daily operational view.

```text
New Assigned Leads

Today's Follow-ups

Overdue Follow-ups

Active Leads

Test Drive Requests

Recently Added Vehicles
```

Quick actions:

```text
Create Lead

Add Vehicle

Update Lead

Add Follow-up

View Assigned Leads
```

---

# 26. Admin Dashboard

The Admin Dashboard should provide complete business visibility.

## Inventory

```text
Total Vehicles

Under Inspection

Available

Reserved

Sold
```

## Leads

```text
New Leads

Active Leads

Lost Leads

Conversion Rate

Overdue Follow-ups
```

## Sales

```text
Cars Sold This Month

Revenue

Profit

Average Selling Price
```

## Salesperson Performance

```text
Leads Assigned

Leads Contacted

Active Deals

Test Drive Requests

Bookings

Sales
```

---

# 27. Finance Management

The Finance Module manages both vehicle-level and business-level finances.

---

## 27.1 Vehicle Costs

Each vehicle can have associated costs.

```text
Purchase Cost

Transportation

Repair

Service

Insurance

Cleaning

Detailing

Photography

Marketing

Other Expenses
```

---

## 27.2 Vehicle Revenue

```text
Selling Price

Additional Revenue

Commission
```

---

## 27.3 Profit Calculation

### Dealership-Owned Vehicle

```text
Total Investment

=
Purchase Price
+
Vehicle Expenses
```

```text
Gross Profit

=
Selling Price
-
Total Investment
```

### Consignment Vehicle

```text
Gross Profit

=
Commission Earned
-
Vehicle Expenses
```

---

# 28. Business Expenses

The business should track expenses unrelated to individual vehicles.

Examples:

```text
Showroom Rent

Electricity

Salaries

Marketing

Fuel

Software Subscriptions

Office Expenses

Other
```

---

# 29. Business Income

Income sources:

```text
Vehicle Sales

Vehicle Commission

Finance Commission

Insurance Commission

Other Revenue
```

---

# 30. Profit and Loss

The system should calculate:

```text
Net Profit

=
Total Revenue
-
Vehicle Costs
-
Business Expenses
```

Reports should support:

```text
Daily

Weekly

Monthly

Yearly
```

---

# 31. Reporting and Analytics

## Lead Reports

```text
Leads by Source

Leads by Salesperson

Lead Conversion Rate

Lost Leads

Average Time to Sale
```

## Inventory Reports

```text
Current Inventory

Unsold for 30 Days

Unsold for 60 Days

Unsold for 90 Days
```

## Sales Reports

```text
Cars Sold

Sales by Salesperson

Sales by Brand

Sales by Month
```

## Finance Reports

```text
Revenue

Expenses

Profit

Vehicle-wise Profit

Monthly Profit and Loss
```

---

# 32. Showroom Information

The public marketplace should display:

```text
Showroom Name

Address

Phone Number

Opening Hours
```

The buyer should have:

```text
Call Showroom

Get Directions
```

Get Directions should open the user's preferred map application.

---

# 33. Notifications

Notifications should be available for internal users.

## Salesperson

```text
New Lead Assigned

Follow-up Due

Follow-up Overdue

Test Drive Request
```

## Admin

```text
New Vehicle Submitted

Vehicle Status Changed

Vehicle Sold

High-Value Lead

Overdue Follow-up
```

## Owner

Future or configurable notifications:

```text
Vehicle Submitted Successfully

Inspection Update

Vehicle Approved

Vehicle Listed

Vehicle Reserved

Vehicle Sold
```

---

# 34. Product Architecture

```text
                         AUTOLEAD
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
     ADMIN               SALESPERSON            FINANCE
       │                     │
       │                     │
       ├─────────────┬───────┘
       │             │
       ▼             ▼
    OWNERS       VEHICLES
       │             │
       ▼             ▼
 OWNER PORTAL    INVENTORY
                     │
                     ▼
              PUBLIC MARKETPLACE
                     │
                     ▼
                   BUYERS
                     │
                     ├───────────────┐
                     ▼               │
               BUYER PORTAL          │
                                     │
                                     ▼
                            BUYER INTEREST
                                     │
                                     ▼
                            INTERNAL LEAD
                                     │
                                     ▼
                               SALESPERSON
                                     │
                                     ▼
                                FOLLOW-UPS
                                     │
                                     ▼
                                NEGOTIATION
                                     │
                                     ▼
                                    SALE
                                     │
                                     ▼
                                  FINANCE
                                     │
                                     ▼
                               PROFIT / LOSS
```

---

# 35. MVP Scope

The planned MVP should include all four user experiences.

## Admin Portal

* User management.
* Salesperson management.
* Owner management.
* Vehicle management.
* Lead management.
* Lead assignment.
* Finance management.
* Basic reporting.
* Showroom configuration.

## Salesperson Portal

* Owner registration.
* Vehicle registration.
* Vehicle image upload.
* Vehicle document upload.
* Manual lead creation.
* Assigned lead management.
* Follow-up management.
* Notes.
* Lead status updates.

## Owner Portal

* Owner registration.
* Profile management.
* Submit vehicle.
* View owned vehicles.
* View vehicle status.
* Upload vehicle information.
* Upload vehicle images.
* Request vehicle removal.

## Buyer Marketplace and Portal

* Browse vehicles.
* Search vehicles.
* Filter vehicles.
* View vehicle details.
* Save favourite vehicles.
* Recently viewed vehicles.
* Buyer profile.
* Vehicle preferences.
* Submit inquiry.
* Request callback.
* Request test drive.
* Call showroom.
* Get directions.

The Buyer Portal will not include lead tracking.

## Finance

* Vehicle expenses.
* Vehicle revenue.
* Vehicle profit calculation.
* Business expenses.
* Business income.
* Basic profit and loss reporting.

---

# 36. Future Enhancements

## Phase 2

* Advanced test-drive scheduling.
* Automated lead assignment.
* WhatsApp integration.
* Push notifications.
* EMI calculator.
* Multi-showroom support.
* Advanced analytics.
* Buyer recommendations.
* Price-drop alerts.
* Vehicle comparison.

---

# 37. Phase 3 — AI Sales Intelligence

The future AI module should assist the internal sales team.

Potential flow:

```text
Phone Conversation
        ↓
Call Recording
        ↓
Transcription
        ↓
AI Analysis
        ↓
Structured Lead Information
```

AI can extract:

```text
Buyer Name

Interested Vehicle

Budget

Purchase Timeline

Finance Requirement

Trade-in Vehicle

Customer Objections

Competitor Vehicles

Recommended Next Action
```

This information should update the internal lead-management system and must not automatically be exposed to the buyer.

---

# 38. Non-Functional Requirements

## Security

The platform must use role-based access control.

Sensitive information includes:

* Owner identity documents.
* RC documents.
* Insurance documents.
* Buyer contact information.
* Financial information.
* Internal lead notes.

Sensitive information must only be accessible to authorized users.

---

## Auditability

The following actions should be recorded:

* Vehicle status changes.
* Lead status changes.
* Lead assignment changes.
* Financial transactions.
* Vehicle price changes.
* Important record modifications.

Each action should include:

```text
User

Timestamp

Previous Value

New Value
```

---

## Performance

The marketplace should be optimized for mobile users.

Important requirements:

* Fast vehicle listing load time.
* Optimized image uploads.
* Responsive design.
* Mobile-friendly salesperson tools.

---

## Scalability

Although the MVP may support a single showroom, the data model should allow future expansion to:

```text
Multiple Showrooms

Multiple Cities

Multiple Branches
```

---

# 39. Success Metrics

The platform should measure:

```text
Lead-to-Contact Rate

Lead-to-Test-Drive Rate

Test-Drive-to-Sale Rate

Overall Lead Conversion Rate

Average Time to Sale

Average Vehicle Profit

Average Inventory Holding Time

Salesperson Conversion Rate

Revenue by Lead Source

Total Active Inventory
```

---

# 40. Core Product Principle

AutoLead is not simply:

```text
A Car Listing Application
```

and it is not simply:

```text
A CRM
```

It is a connected operating platform for a used-car sales and brokering business.

The complete lifecycle is:

```text
OWNER
   ↓
VEHICLE
   ↓
INVENTORY
   ↓
PUBLIC LISTING
   ↓
BUYER DISCOVERY
   ↓
BUYER INTEREST
   ↓
INTERNAL LEAD
   ↓
SALESPERSON
   ↓
FOLLOW-UP
   ↓
NEGOTIATION
   ↓
SALE
   ↓
FINANCE
   ↓
PROFIT
```

The Owner Portal gives vehicle owners visibility into their vehicles.

The Buyer Portal helps buyers discover vehicles and express interest.

The Lead Management system remains internal to the brokerage and sales team.

This separation is essential to the business model:

```text
Buyer = Customer Entity

Lead = Internal Sales Opportunity

Salesperson = Brokerage Relationship Manager
```

The brokerage owns and manages the sales process, while AutoLead provides the technology layer that connects every part of that process.
