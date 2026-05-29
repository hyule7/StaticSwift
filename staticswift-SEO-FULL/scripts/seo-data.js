/* eslint-disable */
/*
 * seo-data.js — niche + location dataset for the page generator.
 * Edit these arrays to control what generate-seo-pages.js produces.
 */

// Niches: { slug, title-case, lower, pluralPhrase, primaryNoun }
// slug is the folder prefix (matches existing repo convention).
const NICHES = [
  { slug: 'barber',             trade: 'Barbers & Hair Salons', tradeLc: 'barber',             noun: 'barber shop' },
  { slug: 'plumber',            trade: 'Plumbers',              tradeLc: 'plumber',            noun: 'plumbing business' },
  { slug: 'electrician',        trade: 'Electricians',          tradeLc: 'electrician',        noun: 'electrical business' },
  { slug: 'photographer',       trade: 'Photographers',         tradeLc: 'photographer',       noun: 'photography studio' },
  { slug: 'restaurant',         trade: 'Restaurants',           tradeLc: 'restaurant',         noun: 'restaurant' },
  { slug: 'cafe',               trade: 'Cafés',                 tradeLc: 'café',               noun: 'café' },
  { slug: 'personal-trainer',   trade: 'Personal Trainers',     tradeLc: 'personal trainer',   noun: 'PT studio' },
  { slug: 'beauty-salon',       trade: 'Beauty Salons',         tradeLc: 'beauty salon',       noun: 'salon' },
  { slug: 'dog-groomer',        trade: 'Dog Groomers',          tradeLc: 'dog groomer',        noun: 'dog grooming business' },
  { slug: 'tattoo-studio',      trade: 'Tattoo Studios',        tradeLc: 'tattoo artist',      noun: 'tattoo studio' },
  { slug: 'florist',            trade: 'Florists',              tradeLc: 'florist',            noun: 'florist' },
  { slug: 'mechanic',           trade: 'Mechanics',             tradeLc: 'mechanic',           noun: 'mechanic shop' },
  { slug: 'optician',           trade: 'Opticians',             tradeLc: 'optician',           noun: 'optician practice' },
  { slug: 'vet',                trade: 'Vets',                  tradeLc: 'vet',                noun: 'veterinary practice' },
  { slug: 'dentist',            trade: 'Dentists',              tradeLc: 'dentist',            noun: 'dental practice' },
  { slug: 'solicitor',          trade: 'Solicitors',            tradeLc: 'solicitor',          noun: 'law firm' },
  { slug: 'accountant',         trade: 'Accountants',           tradeLc: 'accountant',         noun: 'accounting practice' },
  { slug: 'gardener',           trade: 'Gardeners',             tradeLc: 'gardener',           noun: 'gardening business' },
  { slug: 'locksmith',          trade: 'Locksmiths',            tradeLc: 'locksmith',          noun: 'locksmith' },
  { slug: 'removals',           trade: 'Removals Companies',    tradeLc: 'removals company',   noun: 'removals business' },
  { slug: 'cleaning-company',   trade: 'Cleaning Companies',    tradeLc: 'cleaning company',   noun: 'cleaning business' },
  { slug: 'wedding-planner',    trade: 'Wedding Planners',      tradeLc: 'wedding planner',    noun: 'wedding planning business' },
  { slug: 'web-designer',       trade: 'Web Designers',         tradeLc: 'web designer',       noun: 'web design studio' },
  { slug: 'estate-agent',       trade: 'Estate Agents',         tradeLc: 'estate agent',       noun: 'estate agency' },
  { slug: 'driving-instructor', trade: 'Driving Instructors',   tradeLc: 'driving instructor', noun: 'driving school' },
];

// UK locations — sample of additional towns/villages beyond what's already generated
const UK_LOCATIONS_EXTRA = [
  // English market towns
  'aylesbury','beverley','bishops-stortford','bognor-regis','bromsgrove','chipping-norton',
  'cirencester','clitheroe','crowborough','daventry','dorking','east-grinstead',
  'frome','glastonbury','grantham','haslemere','henley-in-arden','hertford',
  'hexham','high-wycombe','hitchin','keighley','kettering','knaresborough',
  'leighton-buzzard','lewes','lichfield','louth','ludlow','market-drayton',
  'market-harborough','melton-mowbray','midhurst','morpeth','newark','newport-shropshire',
  'north-walsham','ottery-st-mary','pickering','pontefract','rugby','saffron-walden',
  'sandwich','sevenoaks','shaftesbury','sherborne','skipton','sleaford',
  'stamford','stratford-upon-avon','tewkesbury','thame','thirsk','tiverton',
  'totnes','uttoxeter','wadhurst','wallingford','wantage','wareham',
  'warwick','wells','wetherby','whitby','wimborne','windsor',
  'witney','woodstock','wymondham','yelverton',
  // Welsh market towns
  'aberdovey','abergavenny','aberystwyth','brecon','builth-wells','caernarfon',
  'cardigan','conwy','dolgellau','hay-on-wye','lampeter','llandrindod-wells',
  'machynlleth','monmouth','narberth','newtown','pwllheli','tenby',
  // Scottish market towns
  'aberlour','annan','ballater','banchory','blairgowrie','callander',
  'castle-douglas','crieff','dingwall','dunblane','dunoon','elgin',
  'fort-william','galashiels','grantown-on-spey','helensburgh','huntly','jedburgh',
  'kelso','kirkcudbright','melrose','moffat','nairn','newton-stewart',
  'oban','peebles','pitlochry','rothesay','st-andrews','stornoway',
  // NI
  'ballymena','banbridge','carrickfergus','coleraine','cookstown','dungannon',
  'enniskillen','holywood','larne','lisburn','newcastle-ni','newry',
  'newtownards','omagh','portrush','portstewart','strabane','warrenpoint',
];

// International cities for worldwide expansion — top metros in English-speaking markets
const INTERNATIONAL_LOCATIONS = [
  // US — top 100 metros
  'new-york-ny','los-angeles-ca','chicago-il','houston-tx','phoenix-az',
  'philadelphia-pa','san-antonio-tx','san-diego-ca','dallas-tx','san-jose-ca',
  'austin-tx','jacksonville-fl','fort-worth-tx','columbus-oh','charlotte-nc',
  'indianapolis-in','san-francisco-ca','seattle-wa','denver-co','washington-dc',
  'boston-ma','el-paso-tx','nashville-tn','detroit-mi','oklahoma-city-ok',
  'portland-or','las-vegas-nv','memphis-tn','louisville-ky','baltimore-md',
  'milwaukee-wi','albuquerque-nm','tucson-az','fresno-ca','mesa-az',
  'sacramento-ca','atlanta-ga','kansas-city-mo','colorado-springs-co','miami-fl',
  'raleigh-nc','omaha-ne','long-beach-ca','virginia-beach-va','oakland-ca',
  'minneapolis-mn','tulsa-ok','arlington-tx','tampa-fl','new-orleans-la',
  // Canada
  'toronto-on','montreal-qc','vancouver-bc','calgary-ab','edmonton-ab',
  'ottawa-on','winnipeg-mb','quebec-city-qc','hamilton-on','kitchener-on',
  'london-on','victoria-bc','halifax-ns','oshawa-on','windsor-on',
  'saskatoon-sk','regina-sk','st-johns-nl','barrie-on','sherbrooke-qc',
  // Australia
  'sydney-nsw','melbourne-vic','brisbane-qld','perth-wa','adelaide-sa',
  'gold-coast-qld','newcastle-nsw','canberra-act','wollongong-nsw','geelong-vic',
  'hobart-tas','townsville-qld','cairns-qld','toowoomba-qld','darwin-nt',
  'launceston-tas','ballarat-vic','bendigo-vic','mackay-qld','rockhampton-qld',
  // New Zealand
  'auckland-nz','wellington-nz','christchurch-nz','hamilton-nz','tauranga-nz',
  'dunedin-nz','palmerston-north-nz','napier-nz','rotorua-nz','new-plymouth-nz',
  // Ireland
  'dublin-ie','cork-ie','limerick-ie','galway-ie','waterford-ie',
  'drogheda-ie','dundalk-ie','swords-ie','bray-ie','navan-ie',
  // South Africa
  'johannesburg-za','cape-town-za','durban-za','pretoria-za','port-elizabeth-za',
  'bloemfontein-za','east-london-za','pietermaritzburg-za','nelspruit-za','polokwane-za',
];

// Pretty-print a slug like "new-york-ny" → "New York, NY"
function prettyLocation(slug) {
  const parts = slug.split('-');
  const lastIsState = parts.length > 1 && parts[parts.length - 1].length === 2 && parts[parts.length - 1] === parts[parts.length - 1].toLowerCase();
  if (lastIsState) {
    const state = parts.pop().toUpperCase();
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') + ', ' + state;
  }
  const lastIsCountry = ['nz','ie','za','uk'].includes(parts[parts.length - 1]);
  if (lastIsCountry) {
    const cc = parts.pop().toUpperCase();
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') + ', ' + cc;
  }
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

// Big expansion list — additional UK villages/towns rarely indexed by competitors
const UK_LOCATIONS_BIG = [
  'abingdon','accrington','adlington','alfreton','alnwick','altrincham-greater','amesbury','ammanford',
  'andover','arundel','ashbourne','ashford-middlesex','ashington','axminster','aylsham','banbury',
  'barnard-castle','barnet','barnstaple','barrow','bath','beaconsfield','bedford-town','belper','berkhamsted',
  'beverley-east','bicester','biddulph','bideford','billericay','bingley','birkenhead','bishop-auckland',
  'bishops-castle','blackpool-fy','blandford','bodmin','boston-lincs','brackley','bradford-on-avon','braintree',
  'brecon-vale','brentwood','bridgnorth','bridgwater','bridlington','bridport','brigg','brigg-north','brixham',
  'broadstairs','bromborough','bromley','bromyard','buckingham','bude','bury-st-edmunds','buxton',
  'caerleon','caerphilly-town','cambridge-cb','cannock','canterbury-kent','carmarthen','carshalton','castleford',
  'caterham','chard','chatham','cheadle','chelmsford','cheltenham','chepstow','chester-le-street',
  'chichester-west','chippenham','chipping-campden','chorley','christchurch-dorset','clevedon','clitheroe-lancs','cobham',
  'colchester','colne','consett','corby-northants','corsham','coventry','cranbrook','crawley',
  'crediton','crewe-cheshire','crewkerne','crowthorne','dartford','dartmouth','daventry-northants','denbigh',
  'devizes','dewsbury-west','didcot-oxon','diss','dorchester-dorset','dorking-surrey','dover','downham-market',
  'driffield','dudley','dulwich-village','duns','dunstable','durham-city','east-grinstead-sussex','eastbourne',
  'ellesmere','ely-cambs','epsom-surrey','eton','evesham-worcs','exeter','exmouth','fakenham',
  'falmouth','fareham-hants','farnham-surrey','faversham','filey','folkestone','fordingbridge','frodsham',
  'frome-somerset','garforth','gillingham-dorset','glossop','goole','gosport','grange-over-sands','grantham-lincs',
  'gravesend','grays','great-malvern','great-yarmouth','greenock','grimsby','guildford-surrey','guisborough',
  'halesowen','halifax','halstead','haltwhistle','harleston','harpenden','harrogate','hartlepool',
  'harwich','haslemere-surrey','hastings','haverhill','hawick-borders','haywards-heath-sussex','hazel-grove','hebden-bridge',
  'helston','hemel-hempstead','henley-on-thames','hereford-city','hertford-herts','hexham-northumberland','high-wycombe-bucks','hinckley',
  'hindhead','hitchin-herts','hoddesdon','holmfirth','holyhead','holywell','honiton','hornsea',
  'horsham-sussex','huddersfield','huntingdon','ilford','ilfracombe','ilkley','ipswich','ironbridge',
  'jarrow','keighley-west','kendal-cumbria','keswick','kettering-northants','kidderminster','kilmarnock-east','kingston-upon-thames',
  'kirkby-lonsdale','knaresborough-yorks','knutsford','lampeter-ceredigion','lancaster','launceston-cornwall','leamington-spa','leatherhead',
  'leek-staffs','leicester-le','leighton-buzzard-beds','leiston','lewes-east','leyland','lichfield-staffs','lincoln-city',
  'littlehampton','liverpool','llandeilo','llandovery','llandrindod','llandudno','llanfair','llangefni',
  'llangollen','llanidloes','locks-heath','loughborough','louth-lincs','lowestoft','ludlow-shropshire','lymington',
  'macclesfield','maidenhead','maidstone','maldon','malmesbury','malton','manchester-m1','mansfield',
  'march','margate','market-bosworth','market-deeping','market-rasen','marlborough','marlow','matlock',
  'melksham','melton-mowbray-leics','merthyr','middlewich','midhurst-sussex','milnthorpe','milton-keynes','minehead',
  'mold','monmouth-mons','morecambe','morpeth-northumberland','musselburgh','nantwich','narberth-pembs','neath',
  'nelson','newark-on-trent','newbury','newcastle-emlyn','newcastle-on-tyne','newent','newhaven','newmarket',
  'newport-iow','newport-wales','newquay-cornwall','newton-abbot','newton-le-willows','newton-stewart-dg','nottingham','nuneaton',
  'oakham','okehampton','oldham','olney','ormskirk','oswestry-shropshire','otley','ottery',
  'oxford','padstow','penarth','penrith','penzance','pershore','peterborough','petersfield',
  'petworth','pickering-yorks','pocklington','pontefract-yorks','poole-dorset','pontardawe','portishead','portsmouth-hants',
  'preston','prestwick','pwllheli-gwynedd','radstock','ramsbottom','ramsgate','reading','redditch',
  'redhill','redruth','reigate','retford','rhyl','richmond-yorks','ringwood','ripon-yorks',
  'rochdale','rochester','romford','romsey','rotherham','rugby-warks','rushden','ryde',
  'rye','saffron-walden-essex','saintfield','saintives','salford','salisbury','sandwich-kent','sawbridgeworth',
  'saxmundham','scarborough','scunthorpe','seaford','sedbergh','selby','selkirk','sevenoaks-kent',
  'shaftesbury-dorset','shanklin','shap','sheffield-s1','sherborne-dorset','sheringham','shrewsbury','sidmouth',
  'sittingbourne','skegness','skipton-yorks','slough','smethwick','solihull','southampton','southport',
  'southwell','southwold','spalding','stafford-staffs','staines','stamford-lincs','stevenage','stockport',
  'stockton-on-tees','stoke-on-trent','stone','stourbridge','stourport','stowmarket','stratford-london','street',
  'stretford','stroud','sudbury-suffolk','sunderland','sutton-coldfield','sutton-in-ashfield','swadlincote','swaffham',
  'swanage','swansea-sa','swindon','tadcaster','tamworth','taunton','tavistock','telford',
  'tenby','tenterden','tewkesbury-glos','thame-oxon','thaxted','thetford','thirsk-yorks','thornbury',
  'thurso','tideswell','tonbridge','torquay','totnes-devon','tottenham','towcester','tring',
  'troon','trowbridge','truro','tunbridge-wells','uckfield','ulverston','uppingham','uttoxeter-staffs',
  'wadebridge','wakefield','wallasey','wallingford-oxon','walsall','waltham-abbey','walton-on-thames','wantage-oxon',
  'ware','wareham-dorset','warminster','warrington','warwick-warks','washington-uk','watford','watton',
  'wellingborough','wellington','wells-somerset','welshpool','welwyn','west-bromwich','westbury','weston-super-mare',
  'wetherby-yorks','weymouth','whitby-yorks','whitchurch','whitehaven','whitley-bay','whitstable','wigan',
  'wigston','willenhall','wilmslow','wimborne-dorset','winchester','windermere','windsor-berks','wisbech',
  'witham','witney-oxon','wokingham','wolverhampton','wombwell','woodbridge','woodstock-oxon','wooler',
  'worcester','workington','worksop','worthing','wrexham','yeovil','yiewsley','york',
];

// Big international expansion — top metros + secondary cities globally
const INTERNATIONAL_BIG = [
  // US states — additional metros
  'aurora-co','aurora-il','bakersfield-ca','baton-rouge-la','birmingham-al','boise-id','buffalo-ny','chandler-az',
  'chesapeake-va','chula-vista-ca','cincinnati-oh','cleveland-oh','colorado-springs-co2','corpus-christi-tx','de-moines-ia','durham-nc',
  'fort-wayne-in','fremont-ca','garland-tx','gilbert-az','glendale-az','greensboro-nc','henderson-nv','hialeah-fl',
  'irving-tx','irvine-ca','jersey-city-nj','laredo-tx','lexington-ky','lincoln-ne','lubbock-tx','madison-wi',
  'modesto-ca','montgomery-al','moreno-valley-ca','newport-news-va','norfolk-va','north-las-vegas-nv','oxnard-ca','plano-tx',
  'rancho-cucamonga-ca','reno-nv','richmond-va','riverside-ca','rochester-ny','saint-paul-mn','salt-lake-city-ut','san-bernardino-ca',
  'santa-clarita-ca','scottsdale-az','spokane-wa','st-louis-mo','st-petersburg-fl','stockton-ca','toledo-oh','wichita-ks',
  // Canada — secondary cities
  'abbotsford-bc','brantford-on','burlington-on','cambridge-on','chatham-on','chilliwack-bc','coquitlam-bc','delta-bc',
  'gatineau-qc','guelph-on','kelowna-bc','kingston-on','laval-qc','lethbridge-ab','longueuil-qc','milton-on',
  'mississauga-on','nanaimo-bc','peterborough-on','red-deer-ab','richmond-bc','richmond-hill-on','saanich-bc','sarnia-on',
  'sault-ste-marie-on','st-catharines-on','sudbury-on','surrey-bc','terrebonne-qc','thunder-bay-on','vaughan-on','waterloo-on',
  'whitby-on','white-rock-bc','wood-buffalo-ab','york-on',
  // Australia — secondary
  'albury-nsw','armidale-nsw','bairnsdale-vic','ballina-nsw','bunbury-wa','bundaberg-qld','busselton-wa','cessnock-nsw',
  'coffs-harbour-nsw','dubbo-nsw','fraser-coast-qld','gladstone-qld','goulburn-nsw','grafton-nsw','griffith-nsw','gympie-qld',
  'kalgoorlie-wa','katoomba-nsw','lismore-nsw','mandurah-wa','maryborough-vic','mildura-vic','mount-gambier-sa','mount-isa-qld',
  'orange-nsw','port-augusta-sa','port-macquarie-nsw','queanbeyan-nsw','rockingham-wa','shepparton-vic','tamworth-nsw','traralgon-vic',
  'wagga-wagga-nsw','warrnambool-vic','whyalla-sa','wodonga-vic',
  // New Zealand — broader
  'blenheim-nz','gisborne-nz','greymouth-nz','invercargill-nz','kapiti-nz','levin-nz','masterton-nz','nelson-nz',
  'oamaru-nz','queenstown-nz','timaru-nz','wanaka-nz','wanganui-nz','whakatane-nz','whangarei-nz',
  // Ireland — secondary
  'athlone-ie','ballina-ie','carlow-ie','castlebar-ie','clonmel-ie','dundalk-ie2','ennis-ie','kilkenny-ie',
  'killarney-ie','letterkenny-ie','longford-ie','mullingar-ie','portlaoise-ie','sligo-ie','thurles-ie','tralee-ie',
  'tullamore-ie','wexford-ie','wicklow-ie',
  // SA — secondary
  'centurion-za','george-za','klerksdorp-za','knysna-za','kroonstad-za','newcastle-za','nigel-za','potchefstroom-za',
  'queenstown-za','randburg-za','rustenburg-za','soweto-za','stellenbosch-za','umtata-za','vereeniging-za','witbank-za',
];

module.exports = { NICHES, UK_LOCATIONS_EXTRA, UK_LOCATIONS_BIG, INTERNATIONAL_LOCATIONS, INTERNATIONAL_BIG, prettyLocation };
