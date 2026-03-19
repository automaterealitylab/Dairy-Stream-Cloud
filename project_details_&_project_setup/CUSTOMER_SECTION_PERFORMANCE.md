# Customer Section Performance Notes

This note explains, in simple terms, why the customer section felt slow and what was changed to improve it.

## Problem

The customer pages were taking extra time to open because of two main reasons:

1. The frontend was loading too much JavaScript at once.
2. Customer pages were re-fetching similar API data again and again.

That meant a customer opening one page could still pay the cost of code that belonged to admin and agent pages.

## What Was Slow Before

### 1. One large frontend bundle

Before the change, the app build produced one very large main JavaScript file.

- Main chunk before optimization: about 1.85 MB

So even if a user only wanted the customer dashboard, the browser still had to download and parse a lot of unrelated code.

### 2. Repeated customer API requests

Customer pages such as payments, deliveries, profile, and subscription were asking the backend for data on page load, and some pages were doing that repeatedly on focus or interval updates.

This caused:

- unnecessary waiting during navigation
- extra backend traffic
- repeated work for data that had just been loaded

## What We Changed

### 1. Route lazy loading

File: `Frontend/src/App.jsx`

We changed the route setup to use `React.lazy()` and `Suspense`.

This means:

- code for a page is downloaded only when that page is needed
- customer users no longer load all admin and agent screens up front
- the first load of the customer section becomes much lighter

### 2. Customer route preloading

File: `Frontend/src/components/customer/layouts/CustomerLayout.jsx`

After a customer page opens, the layout now starts warming up the other customer page chunks during idle time.

This means:

- the current page opens faster because everything is not loaded immediately
- the next customer page often opens faster because its code is already prefetched

Simple idea:

- load now what the user needs now
- quietly prepare what the user is likely to open next

### 3. Short-lived customer API caching

File: `Frontend/src/api/customer/customer.api.js`

We added in-memory caching and request deduping for customer read APIs such as:

- dashboard
- profile
- deliveries
- payments
- subscription

This means:

- if the same data was fetched a moment ago, we reuse it
- if two components ask for the same data at the same time, we share one request instead of sending two
- when a user updates something important, related caches are cleared so fresh data can load again

## Result

After the optimization:

- main chunk after optimization: about 318 kB
- customer pages are now split into smaller chunks
- customer navigation should feel faster, especially after the first page is opened

## Easy Analogy For Interns

Think of the app like a library.

- Before: every visitor had to carry the whole library before reading one chapter.
- After: the visitor carries only the current chapter first, and the next likely chapters are brought nearby in the background.

For data:

- Before: each time someone asked a question, we went back to the archive room.
- After: if we just checked the answer a few seconds ago, we reuse it unless something changed.

## Important Files

- `Frontend/src/App.jsx`
- `Frontend/src/components/customer/layouts/CustomerLayout.jsx`
- `Frontend/src/api/customer/customer.api.js`

## Things To Remember

- Caching is short-lived, not permanent.
- Mutation actions should clear related cache entries.
- Lazy loading improves initial load, but good API design is still important.
- Performance work is usually a mix of frontend bundle size reduction and smarter data fetching.

## How To Explain This In One Line

"We made the customer section faster by loading only the page code that is needed, preloading likely next pages in the background, and avoiding repeated API calls for recently fetched customer data."
