"""
Niche library: per-niche display names, services, body copy fragments, FAQ tweaks.
Each niche entry produces the variable content that differentiates a page.

Adding a niche:
  slug:      url-safe id, matches existing folder naming
  singular:  "plumber"  (used in body copy)
  plural:    "plumbers" (used in audience-style copy: "plumbers in X")
  h1_label:  "Plumbers"  (used in H1 / titles, capitalised)
  display:   "Plumbers & Heating Engineers" (used as breadcrumb / dropdown label)
  icon:      single emoji used in service grid
  services:  6 short service strings shown in the grid
  intro:     1-sentence niche-specific intro for the "why you need a website" section
  body_2:    1-sentence niche-specific second paragraph (does NOT mention any market)
"""

NICHES = {
    "web-designer": {
        "singular": "web designer",
        "plural": "web designers",
        "h1_label": "Web Design",
        "display": "Web Design",
        "icon": "💻",
        "services": [
            "Custom homepage design", "Mobile-responsive layouts",
            "On-page SEO", "Contact & enquiry forms",
            "Fast static hosting", "One free revision",
        ],
        "intro": "Getting found online is harder than ever, and a slow, generic template won't cut it.",
        "body_2": "A handcrafted site loads faster, ranks better and converts more enquiries than a drag-and-drop builder. StaticSwift delivers a clean, fast, SEO-ready site in 24 hours.",
    },
    "plumber": {
        "singular": "plumber",
        "plural": "plumbers",
        "h1_label": "Plumbers",
        "display": "Plumbers & Heating Engineers",
        "icon": "🔧",
        "services": [
            "Emergency call-outs", "Boiler repair & install",
            "Bathroom fitting", "Leak detection",
            "Power flushing", "Annual servicing",
        ],
        "intro": "Most plumbing jobs are booked from a phone search — your customers need to find you fast and call you faster.",
        "body_2": "A clean site with click-to-call, your service area, and a few real reviews converts better than any directory listing. StaticSwift builds it in 24 hours.",
    },
    "electrician": {
        "singular": "electrician",
        "plural": "electricians",
        "h1_label": "Electricians",
        "display": "Electricians",
        "icon": "⚡",
        "services": [
            "Domestic rewires", "Fuse board upgrades",
            "EV charger install", "EICR reports",
            "Lighting design", "Fault finding",
        ],
        "intro": "Whether it's a fuse board upgrade or an EV charger install, customers Google your name before they call.",
        "body_2": "A modern, fast website with clear pricing, your certifications, and an easy enquiry form wins the booking. StaticSwift builds it in 24 hours.",
    },
    "builder": {
        "singular": "builder",
        "plural": "builders",
        "h1_label": "Builders",
        "display": "Builders",
        "icon": "🧱",
        "services": [
            "Extensions", "Loft conversions",
            "New builds", "Renovations",
            "Garden rooms", "Project management",
        ],
        "intro": "Big jobs start with trust — and trust starts with a website that doesn't look like it was thrown together.",
        "body_2": "A proper portfolio of finished projects, clear contact details and a credible online presence is what wins five-figure jobs. StaticSwift builds it in 24 hours.",
    },
    "scaffolder": {
        "singular": "scaffolder",
        "plural": "scaffolders",
        "h1_label": "Scaffolders",
        "display": "Scaffolders",
        "icon": "🏗️",
        "services": [
            "Domestic scaffolding", "Commercial scaffolding",
            "New build scaffolding", "Roofing platforms",
            "Chimney access", "Temporary roofing",
        ],
        "intro": "Builders, roofers and contractors all check your website before they put you on a job.",
        "body_2": "A credible site with real photos of your kit on site, your insurance details and a fast quote form is what gets you on the call list. StaticSwift builds it in 24 hours.",
    },
    "carpet-cleaner": {
        "singular": "carpet cleaner",
        "plural": "carpet cleaners",
        "h1_label": "Carpet Cleaners",
        "display": "Carpet & Upholstery Cleaners",
        "icon": "🧼",
        "services": [
            "Carpet cleaning", "Rug cleaning",
            "Upholstery cleaning", "Stain removal",
            "Pet odour treatment", "Commercial cleans",
        ],
        "intro": "Carpet cleaning is a same-week decision — customers search, click, compare three sites, then book.",
        "body_2": "A clean before-and-after gallery, honest pricing and a simple online enquiry form turns that search into a booking. StaticSwift builds it in 24 hours.",
    },
    "pest-control": {
        "singular": "pest control technician",
        "plural": "pest control services",
        "h1_label": "Pest Control",
        "display": "Pest Control",
        "icon": "🐀",
        "services": [
            "Rodent control", "Wasp nest removal",
            "Bedbug treatment", "Bird proofing",
            "Cockroach treatment", "Annual contracts",
        ],
        "intro": "Pest problems are urgent — most enquiries land within an hour of someone spotting droppings or a nest.",
        "body_2": "A clear, professional site with your accreditations, call-out times and a simple contact form wins the enquiry against the generic Google Ads. StaticSwift builds it in 24 hours.",
    },
    "painter-decorator": {
        "singular": "painter & decorator",
        "plural": "painters & decorators",
        "h1_label": "Painters & Decorators",
        "display": "Painters & Decorators",
        "icon": "🎨",
        "services": [
            "Interior painting", "Exterior painting",
            "Wallpapering", "Plastering & filling",
            "Spray finishes", "Commercial work",
        ],
        "intro": "Painting is a high-trust hire — homeowners want to see proof, not promises.",
        "body_2": "A clean portfolio of completed work, real client quotes and an easy enquiry form does the selling for you. StaticSwift builds it in 24 hours.",
    },
    "dentist": {
        "singular": "dentist",
        "plural": "dentists",
        "h1_label": "Dental Practices",
        "display": "Dentists",
        "icon": "🦷",
        "services": [
            "General dentistry", "Cosmetic treatments",
            "Invisalign & orthodontics", "Implants",
            "Hygienist appointments", "Emergency appointments",
        ],
        "intro": "Patients pick a dentist the way they pick a restaurant — they Google, they read, they decide in two minutes.",
        "body_2": "A calm, professional site with your treatments, your team and an easy booking form converts visitors into new-patient enquiries. StaticSwift builds it in 24 hours.",
    },
    "mechanic": {
        "singular": "mechanic",
        "plural": "mechanics",
        "h1_label": "Mechanics & Garages",
        "display": "Mechanics & Garages",
        "icon": "🔩",
        "services": [
            "MOTs", "Servicing",
            "Brakes & clutches", "Diagnostics",
            "Tyres & tracking", "Air-con regas",
        ],
        "intro": "An MOT booking is a three-tab decision — yours needs to look the most trustworthy, fastest.",
        "body_2": "A clear site with your prices, your location, and a simple booking form beats every directory listing. StaticSwift builds it in 24 hours.",
    },
    "locksmith": {
        "singular": "locksmith",
        "plural": "locksmiths",
        "h1_label": "Locksmiths",
        "display": "Locksmiths",
        "icon": "🔑",
        "services": [
            "Emergency lockouts", "Lock changes",
            "uPVC door repairs", "Security upgrades",
            "Safe opening", "Commercial work",
        ],
        "intro": "A locksmith call is almost always an emergency — the customer is on the street, on a phone, picking the first credible site.",
        "body_2": "A site that loads instantly on mobile with a giant call button and your call-out time is what gets the phone to ring. StaticSwift builds it in 24 hours.",
    },
    "dog-groomer": {
        "singular": "dog groomer",
        "plural": "dog groomers",
        "h1_label": "Dog Groomers",
        "display": "Dog Groomers",
        "icon": "🐶",
        "services": [
            "Full grooms", "Bath & brush",
            "Nail clipping", "De-shedding treatments",
            "Hand stripping", "Puppy first grooms",
        ],
        "intro": "Owners pick a groomer based on photos and reviews — your site needs both, front and centre.",
        "body_2": "A bright gallery of happy dogs, clear pricing and a simple booking form fills your diary weeks ahead. StaticSwift builds it in 24 hours.",
    },
    "photographer": {
        "singular": "photographer",
        "plural": "photographers",
        "h1_label": "Photographers",
        "display": "Photographers",
        "icon": "📸",
        "services": [
            "Weddings", "Family portraits",
            "Newborn shoots", "Brand & headshots",
            "Events", "Commercial work",
        ],
        "intro": "A photographer's site is their portfolio — it has to look as good as the work.",
        "body_2": "A fast, image-led site with clean galleries, real client words and an easy enquiry form is what books premium jobs. StaticSwift builds it in 24 hours.",
    },
    "gardener": {
        "singular": "gardener",
        "plural": "gardeners",
        "h1_label": "Gardeners & Landscapers",
        "display": "Gardeners & Landscapers",
        "icon": "🌿",
        "services": [
            "Garden maintenance", "Landscaping & design",
            "Lawn care", "Hedge trimming",
            "Patio & decking", "Garden clearance",
        ],
        "intro": "Garden work is a spring-and-summer rush — the customers who book are the ones who can find you first.",
        "body_2": "A clean portfolio of finished gardens, honest pricing and an easy enquiry form fills the diary. StaticSwift builds it in 24 hours.",
    },
    "accountant": {
        "singular": "accountant",
        "plural": "accountants",
        "h1_label": "Accountants",
        "display": "Accountants",
        "icon": "📊",
        "services": [
            "Self-assessment", "Limited company accounts",
            "VAT returns", "Payroll",
            "Bookkeeping", "Tax planning",
        ],
        "intro": "Small business owners pick an accountant on trust — and trust starts with a site that looks like a real practice, not a clip-art template.",
        "body_2": "A calm, professional site with your services, your qualifications and a simple enquiry form wins the appointment. StaticSwift builds it in 24 hours.",
    },
    # Optional extras kept available for cross-link variety and one-off rebuilds
    "mobile-hairdresser": {
        "singular": "mobile hairdresser",
        "plural": "mobile hairdressers",
        "h1_label": "Mobile Hairdressers",
        "display": "Mobile Hairdressers",
        "icon": "💇",
        "services": [
            "Cut & blow-dry", "Colour & highlights",
            "Wedding hair", "Mens cuts at home",
            "Elderly home visits", "Childrens cuts",
        ],
        "intro": "Mobile hairdressing is a referral-and-Google business — your site has to do both jobs at once.",
        "body_2": "Honest pricing, a few real client photos and a simple booking form fills the diary. StaticSwift builds it in 24 hours.",
    },
    "nursery": {
        "singular": "nursery",
        "plural": "nurseries",
        "h1_label": "Nurseries",
        "display": "Nurseries & Pre-Schools",
        "icon": "🧸",
        "services": [
            "Baby room (0-2)", "Toddler room (2-3)",
            "Pre-school (3-5)", "Holiday clubs",
            "Funded hours", "Outdoor learning",
        ],
        "intro": "Parents pick a nursery the way they pick a school — slowly, carefully, and entirely from your website.",
        "body_2": "Warm photos, clear info on rooms and hours, and an easy booking-to-visit form converts visiting parents into placements. StaticSwift builds it in 24 hours.",
    },
    "skip-hire": {
        "singular": "skip hire company",
        "plural": "skip hire services",
        "h1_label": "Skip Hire",
        "display": "Skip Hire",
        "icon": "🗑️",
        "services": [
            "2-yard mini skips", "4-yard midi skips",
            "8-yard builders skips", "Roll-on roll-off",
            "Same-day delivery", "Wait & load",
        ],
        "intro": "Skip hire is a same-day decision — the customer wants a price, a size and a delivery slot in under a minute.",
        "body_2": "A clear price grid, an honest size guide and a simple booking form wins the order. StaticSwift builds it in 24 hours.",
    },
    "tattoo-studio": {
        "singular": "tattoo studio",
        "plural": "tattoo studios",
        "h1_label": "Tattoo Studios",
        "display": "Tattoo Studios",
        "icon": "🖋️",
        "services": [
            "Custom designs", "Cover-ups",
            "Fine line work", "Black & grey",
            "Colour pieces", "Walk-ins",
        ],
        "intro": "Clients pick a studio entirely on portfolio — your artists' work has to be one click from the homepage.",
        "body_2": "A clean image-led portfolio, clear booking info and an easy enquiry form fills the calendar. StaticSwift builds it in 24 hours.",
    },
    "caterer": {
        "singular": "caterer",
        "plural": "caterers",
        "h1_label": "Caterers",
        "display": "Caterers",
        "icon": "🍽️",
        "services": [
            "Wedding catering", "Corporate events",
            "Private dining", "Buffets & canapes",
            "Funeral catering", "Hot food delivery",
        ],
        "intro": "Catering is a high-trust, high-value hire — the booking decision is mostly made before anyone picks up the phone.",
        "body_2": "Real food photography, clear sample menus and a simple enquiry form converts browsers into bookings. StaticSwift builds it in 24 hours.",
    },
    "roofer": {
        "singular": "roofer",
        "plural": "roofers",
        "h1_label": "Roofers",
        "display": "Roofers",
        "icon": "🏠",
        "services": [
            "Flat roofing", "Pitched roofing",
            "Roof repairs", "Lead work",
            "Guttering & fascias", "Chimney work",
        ],
        "intro": "Roof work is expensive and customers compare three or four firms before they call.",
        "body_2": "A site with real photos of finished roofs, your guarantees and a simple quote form is what gets you the call. StaticSwift builds it in 24 hours.",
    },
    "florist": {
        "singular": "florist",
        "plural": "florists",
        "h1_label": "Florists",
        "display": "Florists",
        "icon": "💐",
        "services": [
            "Wedding flowers", "Funeral tributes",
            "Birthday bouquets", "Subscription flowers",
            "Local delivery", "Corporate flowers",
        ],
        "intro": "Most floral orders happen in the same hour the customer searches — your site has to make the order easy.",
        "body_2": "Beautiful photography, clear delivery info and a simple order form turns search into sale. StaticSwift builds it in 24 hours.",
    },
    "restaurant": {
        "singular": "restaurant",
        "plural": "restaurants",
        "h1_label": "Restaurants",
        "display": "Restaurants",
        "icon": "🍴",
        "services": [
            "Menu & specials", "Online reservations",
            "Takeaway ordering", "Private events",
            "Wine list", "Gift vouchers",
        ],
        "intro": "Hungry customers pick a restaurant from Google in under a minute — your site is the deciding factor.",
        "body_2": "Real food photography, today's menu and a booking-or-takeaway button above the fold wins the table. StaticSwift builds it in 24 hours.",
    },
    "pub": {
        "singular": "pub",
        "plural": "pubs",
        "h1_label": "Pubs & Bars",
        "display": "Pubs & Bars",
        "icon": "🍺",
        "services": [
            "Food menu", "Live music & events",
            "Sunday roasts", "Private hire",
            "Quiz nights", "Sport on the big screen",
        ],
        "intro": "Pub bookings are a same-day decision — your site needs the menu, hours and a booking button up top.",
        "body_2": "A warm site with real photos, clear what's-on info and a simple booking form fills tables. StaticSwift builds it in 24 hours.",
    },
}


def get(slug: str) -> dict:
    """Return niche entry by slug, falling back to a generic 'business' record."""
    if slug in NICHES:
        return NICHES[slug]
    return {
        "singular": slug.replace("-", " "),
        "plural": slug.replace("-", " ") + "s",
        "h1_label": slug.replace("-", " ").title(),
        "display": slug.replace("-", " ").title(),
        "icon": "✨",
        "services": [
            "Bespoke service", "Professional standards",
            "Free quotes", "Fast response",
            "Local coverage", "Customer-first",
        ],
        "intro": "Customers compare three or four local options before they choose — your website needs to be the one they trust.",
        "body_2": "A clean, professional site with real photos and an easy enquiry form wins more work than any directory. StaticSwift builds it in 24 hours.",
    }
