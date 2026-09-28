# FEATURES NOT YET REQUIRED: Anti-Overengineering Directive
**The Petal & Bloom Commerce Operating System**
**Role:** Chief Technology Officer & Principal Systems Architect

---

## 1. The Discipline of Saying "No"

A common failure mode for e-commerce software is the premature implementation of enterprise features designed for multi-million-dollar marketplaces. 

Every feature built carries a **lifetime maintenance tax**. The following features have been deliberately audited, challenged, and **excluded from the immediate roadmap**.

---

## 2. Excluded Features Catalog

| Excluded Feature | Why It Sounds Appealing | Operational & Engineering Reality | When to Re-evaluate |
| :--- | :--- | :--- | :--- |
| **1. Multi-Warehouse Inventory Routing** | Allows assigning orders to different fulfillment hubs across India. | The Petal & Bloom operates from a **single artisan studio in Bengaluru**. Multi-warehouse logic introduces inventory fragmentation, split orders, and double courier fees for zero business benefit. | When physical satellite studios open in Mumbai/Delhi. |
| **2. Automated AI Customer Service Chatbot** | Answers customer questions automatically without human staff. | Floral gifting is intimate and high-stakes. Automated bots frequently misinterpret grief, anniversary, or proposal nuances, infuriating customers. Human WhatsApp concierge delivers a 10x higher brand experience. | Never. Keep concierge human-driven. |
| **3. Real-Time Distributed Redis Inventory Locking** | Holds stock in memory for 10 minutes while customer types address. | Complex Redis infrastructure required. Crochet florals are made slowly; customers rarely purchase in millisecond flash-mob races. PostgreSQL transactional updates are more than sufficient. | If doing televised flash sales (> 1,000 orders/minute). |
| **4. Recurring Subscription Bouquets** | Monthly floral subscriptions for corporate desks or homes. | Archival crochet blooms are **everlasting**. They do not wilt. Customers do not need a new crochet bouquet every 30 days. Subscriptions conflict with the brand's core value proposition. | If launching a corporate gifting line. |
| **5. Native iOS / Android Mobile Apps** | App Store presence with mobile push notifications. | Customer acquisition cost (CAC) for mobile app installs is 5–10x higher than web. Gifting is episodic (2–4 times/year). A responsive PWA web app serves 100% of mobile needs at zero app store tax. | When repeat customer base exceeds 50,000 active patrons. |
| **6. Automated Multi-Tier Influencer Commission Payouts** | Direct automated banking transfers to affiliate bank accounts. | Massive compliance overhead: TDS withholding, PAN verification, and automated Escrow APIs. The volume of influencer orders can be settled easily via monthly manual NEFT transfers. | When managing > 100 active paid affiliates monthly. |
| **7. Complex Multi-Stem Bill of Materials (BOM) Tracking** | Tracking yarn grams, floral wire gauges, and glue stick meters per stem. | Artisans will not weigh yarn before sculpting a daisy. Tracking raw materials at the micro-level will lead to fake reporting and operational friction. | When annual production exceeds 100,000 stems. |
| **8. Multi-Currency / International Cross-Border Shipping** | Accepting USD/EUR and shipping via DHL Express internationally. | Complex customs declarations, biological quarantine certifications, international card chargeback risks, and high shipping costs (₹3,000+ per box). | When domestic Indian operations are fully optimized and profitable. |

---

## 3. Guiding Rule for Developers

If a pull request or implementation proposal includes any of the above 8 features, it must be **rejected immediately**. Keep the core engine simple, fast, and bulletproof.
