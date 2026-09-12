## The Problem

### 1.1 Origin story

The direct trigger for this project is the on-campus GrubHub ordering kiosks — the shared touchscreens students line up to tap, in the same spot, hundreds of times a day, that as far as any of us have seen are never visibly sanitized between users. That everyday annoyance is really a specific instance of a much broader, well-documented public-health and UX problem with self-service touchscreens in general.

### 1.2 Touchscreens are surprisingly dirty, and it's well studied

This isn't just an intuition — it's been measured repeatedly:

- A widely cited 2019 investigation swabbed self-order touchscreens at eight McDonald's locations in the UK and found every single screen tested positive for an array of harmful bacteria, including gut and fecal bacteria that a reviewing microbiologist compared to the kind of infections typically picked up in hospitals. The same testing turned up Staphylococcus (a bacterium of particular concern because of how readily it spreads and its links to antibiotic resistance) as well as Klebsiella, which is associated with urinary tract infections, septicemia, and diarrhea.
- A peer-reviewed comparison of grocery-store checkout touchscreens found 59% of the sampled screens carried coliform bacteria such as E. coli, compared with only 12% of touchscreens sampled in a hospital setting — i.e., the average grocery self-checkout kiosk tested dirtier than a hospital touchscreen.
- Separate industry testing has put the figure even higher, reporting that roughly half of supermarket self-checkout touchscreens carried detectable fecal bacteria and Staphylococcus aureus.
- A broader survey of 11 public touchscreen kiosks — spanning a pharmacy checkout, a train check-in terminal, a grocery checkout, a kiosk rental machine, an airport terminal, and several ATMs — found that the grocery-store checkout screen and a transit check-in terminal carried the highest bacterial loads of the set.
- Industry commentary following the McDonald's findings noted that the story was seen as effectively the first public self-service-kiosk story to surface as a genuine public-health concern, and it pushed kiosk vendors to re-examine their sanitation practices industry-wide.

The mechanism is intuitive once you see the data: these are surfaces touched by hundreds of different, unwashed hands a day, in the exact same few screen locations (the same buttons get pressed over and over), and — unlike a doorknob — the interaction requires you to then handle and eat food.

### 1.3 The problem is structural, not just a cleaning schedule

You cannot solve this by cleaning more. Kiosks are typically wiped once or a few times per shift at best; a queue of customers repopulates the contamination within minutes of a wipe-down. A patent filed specifically around this problem area frames it well: because on-screen transaction UIs render their tappable options in consistent, repeated locations, every customer during a shift ends up touching the exact same physical hotspot, guaranteeing repeated hand-to-surface-to-hand transfer opportunities all day long. Recommended mitigations in the food-safety literature are all reactive and low-tech — frequent sanitizer wipe-downs and placing hand-sanitizer dispensers near the kiosks — which treats the symptom, not the interaction model that causes it.

### 1.4 This problem is getting bigger, not smaller

Self-service kiosks are also being installed at a rapidly accelerating rate, meaning the surface area of the problem (literally) keeps growing:

- Self-service kiosk installations in quick-service restaurants surged 43% globally between 2021 and 2023, reaching nearly 350,000 machines worldwide.
- The self-service kiosk market overall was valued at roughly $34.4 billion in 2024 and is projected to grow at a 10.9% compound annual rate to about $62.5 billion by 2030, driven largely by labor shortages and shifting consumer preference toward self-service.
- Consumer acceptance has crossed a tipping point: roughly 78% of quick-service restaurant customers now say they prefer ordering at a kiosk over a cashier.
- Adoption isn't limited to younger users, either — more than a quarter of consumers aged 65 and older reported placing an order via self-service kiosk within the past year, suggesting the format is quickly becoming the default rather than a niche behavior.

Put together: shared touchscreens are demonstrably one of the dirtiest common surfaces in public life, the interaction pattern that causes it is structural rather than fixable with a cleaning schedule, and the number of these machines in daily use is expanding fast. That's the gap AirTouch targets — not a hygiene theater fix, but a different *input modality* for the exact same kiosk UIs, requiring no new hardware most kiosks don't already have (they already have a camera or can cheaply add one), no app download, and no behavior change beyond "point instead of tap."

### 1.5 Sources

- Fatherly, *Study Finds Fecal Bacteria on Every McDonald's Touchscreen Tested* — https://www.fatherly.com/news/study-fecal-bacteria-mcdonalds-touchscreen
- Fox News, *McDonald's touchscreens test positive for traces of feces, deadly bacteria* — https://www.foxnews.com/food-drink/mcdonalds-touchscreens-test-positive-for-traces-of-feces-deadly-bacteria
- ScienceDirect, *Prevalence of Fecal Indicators and Viruses on Touchscreens and Other High-Touch Surfaces in Retail Food Establishments in the United States* — https://www.sciencedirect.com/science/article/pii/S0362028X26001456
- Pal International, *Germ Hotspots in Your Food Business, Part 2* — https://palinternational.com/germ-hotspots-in-your-food-business-part-2/
- QSR Web, *Keeping screens clean of pathogens unseen: A challenge for self-service age* — https://www.qsrweb.com/articles/keeping-screens-clean-of-pathogens-unseen-a-challenge-for-self-service-age/
- Kiosk Marketplace, *Study: Kiosks are breeding ground for germs* — https://www.kioskmarketplace.com/blogs/study-kiosks-are-breeding-ground-for-germs/
- USPTO filing, *Touchless transaction terminal processing* — https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11741448
- KORONA POS, *Self-Service Kiosks in QSRs Surge 43% in Two Years* — https://koronapos.com/blog/kiosk-adoption-retail/
- LocalExpress, *22 In-Store Kiosk Statistics: Every Business Owner Should Know in 2025* — https://localexpress.io/post/in-store-kiosk-statistics
- Epson Blog, *Self order kiosks in the fast food space* — https://blog.epson.com/self-order-kiosks-in-the-fast-food-space

*(Numbers above are directional industry figures, not our own measurements — good for framing the problem in a pitch, not to be presented as rigorously peer-reviewed in every case. The McDonald's/grocery bacterial-contamination findings are the strongest, most citable evidence; the market-size figures come from industry blogs aggregating vendor reports and should be treated as illustrative.)*
