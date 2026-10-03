import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const currentLeads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));

const rfiLeads = [
  {
    id: 101,
    name: "Nik Shipping and Logistics",
    category: "Website Design / Redesign",
    location: "London, Eng E2 0Aa, United Kingdom",
    phone: "+447806693559",
    email: "info@nikshipping.com",
    website: "http://www.nikshipping.com/",
    websiteStatus: "Unverified",
    emailStatus: "Supplied",
    score: null,
    stage: "RFI_INBOUND",
    request_type: "website design/redesign"
  },
  {
    id: 102,
    name: "Best House Buyer",
    category: "Website Design / Redesign",
    location: "London, Eng W1w 7Lt, United Kingdom",
    phone: "+448000487528",
    email: "info@besthousebuyer.co.uk",
    website: "https://www.besthousebuyer.co.uk/",
    websiteStatus: "Unverified",
    emailStatus: "Supplied",
    score: null,
    stage: "RFI_INBOUND",
    request_type: "website design/redesign"
  },
  {
    id: 103,
    name: "Blogging and Best-Selling Introduction",
    category: "Website Design / Redesign",
    location: "London Se8 4Hh, United Kingdom",
    phone: "+447399803782",
    email: null,
    website: "https://thetopwebhosts.com/",
    websiteStatus: "Unverified",
    emailStatus: "Not supplied",
    score: null,
    stage: "RFI_INBOUND",
    request_type: "website design/redesign"
  },
  {
    id: 104,
    name: "Lynx London",
    category: "Website Design / Redesign",
    location: "London, Eng W1s 1Hs, United Kingdom",
    phone: "+447899931885",
    email: "contact@lynxlondon.com",
    website: "http://lynxlondon.com/",
    websiteStatus: "Unverified",
    emailStatus: "Supplied",
    score: null,
    stage: "RFI_INBOUND",
    request_type: "website design/redesign"
  },
  {
    id: 105,
    name: "Hspg",
    category: "Website Design / Redesign",
    location: "Manchester, Eng M12 6PN, United Kingdom",
    phone: "+441618206559",
    email: "hello@hspg.co.uk",
    website: "https://hspg.co.uk/",
    websiteStatus: "Unverified",
    emailStatus: "Supplied",
    score: null,
    stage: "RFI_INBOUND",
    request_type: "website design/redesign"
  },
  {
    id: 106,
    name: "Mda Consulting",
    category: "Website Design / Redesign",
    location: "Birmingham, West Midlands B2 5NY, United Kingdom",
    phone: "+441212333839",
    email: null,
    website: "http://www.mdaconsulting.co.uk",
    websiteStatus: "Unverified",
    emailStatus: "Not supplied",
    score: null,
    stage: "RFI_INBOUND",
    request_type: "website design/redesign"
  },
  {
    id: 107,
    name: "Prime Estates",
    category: "Website Design / Redesign",
    location: "Birmingham, Eng B25 8Ur, United Kingdom",
    phone: "+441217833422",
    email: "castlebromwich@primeestatesuk.com",
    website: "https://www.primeestatesuk.com/",
    websiteStatus: "Unverified",
    emailStatus: "Supplied",
    score: null,
    stage: "RFI_INBOUND",
    request_type: "website design/redesign"
  },
  {
    id: 108,
    name: "UK Mail Courier",
    category: "Website Design / Redesign",
    location: "Leeds, Eng LS27 7JQ, United Kingdom",
    phone: "+441133074860",
    email: null,
    website: "http://www.ukmail.com",
    websiteStatus: "Unverified",
    emailStatus: "Not supplied",
    score: null,
    stage: "RFI_INBOUND",
    request_type: "website design/redesign"
  }
];

// Check if already added
const existingIds = new Set(currentLeads.map(l => l.id));
const toAdd = rfiLeads.filter(l => !existingIds.has(l.id));

const updatedLeads = [...currentLeads, ...toAdd];
fs.writeFileSync(leadsPath, JSON.stringify(updatedLeads, null, 2) + '\n');
console.log(`Successfully added ${toAdd.length} RFI website design/redesign leads. Total leads now: ${updatedLeads.length}`);
