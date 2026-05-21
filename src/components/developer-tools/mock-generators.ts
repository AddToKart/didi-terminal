// Dedicated mock data generator seeds and logic for didi-terminal.

export type FieldType =
  | "uuid"
  | "id"
  | "fullName"
  | "firstName"
  | "lastName"
  | "gender"
  | "email"
  | "username"
  | "password"
  | "phone"
  | "avatarUrl"
  | "role"
  | "streetAddress"
  | "city"
  | "state"
  | "country"
  | "zipCode"
  | "latitude"
  | "longitude"
  | "word"
  | "sentence"
  | "paragraph"
  | "hexColor"
  | "companyName"
  | "jobTitle"
  | "price"
  | "currency"
  | "creditCard"
  | "ipv4"
  | "ipv6"
  | "macAddress"
  | "domain"
  | "url"
  | "userAgent"
  | "date"
  | "time"
  | "timestamp"
  | "number"
  | "boolean"
  | "customArray";

export interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  options?: string; // used for customArray, number range (e.g. "0,100"), boolean prob (e.g. "0.3")
}

export interface SchemaPreset {
  name: string;
  description: string;
  tableName: string;
  fields: SchemaField[];
}

// --- Data Pools ---
const firstNames = [
  "James", "John", "Robert", "Michael", "William", "David", "Richard", "Charles", "Joseph", "Thomas",
  "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen",
  "Matthew", "Mark", "Luke", "Alex", "Jordan", "Taylor", "Morgan", "Sam", "Chris", "Jamie",
  "Sophia", "Emma", "Olivia", "Ava", "Isabella", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn"
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"
];

const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "example.com", "didi.dev", "nexus.io", "stark.com"];

const cities = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", 
  "Dallas", "San Jose", "Austin", "Jacksonville", "San Francisco", "Seattle", "Denver", "Boston", "Miami"
];

const states = [
  "New York", "California", "Illinois", "Texas", "Arizona", "Pennsylvania", "Florida", "Washington", 
  "Colorado", "Massachusetts", "Georgia", "North Carolina", "Ohio", "Michigan", "Virginia", "Oregon"
];

const countries = [
  "United States", "Canada", "United Kingdom", "Germany", "France", "Japan", "Australia", 
  "Singapore", "Netherlands", "Sweden", "Switzerland", "Brazil", "India", "South Korea"
];

const streetNames = ["Main St", "Broadway", "Oak St", "Pine St", "Maple Ave", "Cedar Rd", "Elm St", "Park Ln", "Sunset Blvd", "Washington St"];

const companyPrefixes = ["Stark", "Wayne", "Acme", "Globex", "Initech", "Umbrella", "Cyberdyne", "Hooli", "Soylent", "Veer"];
const companySuffixes = ["Industries", "Corp", "Inc", "Group", "Solutions", "Technologies", "Laboratories", "Partners"];

const jobLevels = ["Junior", "Senior", "Lead", "Principal", "Staff", "Director", "VP", "Associate"];
const jobFields = ["Software Engineer", "Frontend Developer", "Backend Developer", "Product Manager", "UX Designer", "Data Scientist", "DevOps Engineer", "Security Analyst", "System Architect"];

const currencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "SGD", "CHF"];

const words = [
  "agile", "framework", "robust", "synergy", "paradigm", "scalability", "pipeline", "interface", "protocol", "architecture",
  "dynamic", "optimized", "cloud", "security", "integration", "deployment", "asynchronous", "synchronous", "concurrency", "efficiency"
];

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
];

// --- Helpers ---
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number, decimals = 4) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

// --- Generators ---
export const generators: Record<FieldType, (field: SchemaField, context: any) => any> = {
  uuid: () => {
    try {
      return crypto.randomUUID();
    } catch {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  },

  id: (_field, context) => (context.index !== undefined ? context.index + 1 : randomInt(1, 1000)),

  firstName: (_field, context) => {
    if (!context.firstName) context.firstName = randomItem(firstNames);
    return context.firstName;
  },

  lastName: (_field, context) => {
    if (!context.lastName) context.lastName = randomItem(lastNames);
    return context.lastName;
  },

  fullName: (field, context) => {
    const first = generators.firstName(field, context);
    const last = generators.lastName(field, context);
    return `${first} ${last}`;
  },

  gender: () => randomItem(["Male", "Female", "Non-binary", "Prefer not to say"]),

  email: (field, context) => {
    if (!context.email) {
      const first = generators.firstName(field, context).toLowerCase();
      const last = generators.lastName(field, context).toLowerCase();
      const domain = randomItem(domains);
      context.email = `${first}.${last}@${domain}`;
    }
    return context.email;
  },

  username: (field, context) => {
    const first = generators.firstName(field, context).toLowerCase();
    const last = generators.lastName(field, context).toLowerCase();
    return `${first}_${last}${randomInt(10, 99)}`;
  },

  password: () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    return Array.from({ length: 12 }, () => chars[randomInt(0, chars.length - 1)]).join("");
  },

  phone: () => `+1 (${randomInt(200, 999)}) ${randomInt(100, 999)}-${randomInt(1000, 9999)}`,

  avatarUrl: (field, context) => {
    const email = generators.email(field, context);
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
  },

  role: () => randomItem(["Admin", "Editor", "User", "Moderator", "Guest"]),

  streetAddress: () => `${randomInt(100, 9999)} ${randomItem(streetNames)}`,

  city: () => randomItem(cities),

  state: () => randomItem(states),

  country: () => randomItem(countries),

  zipCode: () => `${randomInt(10000, 99999)}`,

  latitude: () => randomFloat(-90, 90, 6).toString(),

  longitude: () => randomFloat(-180, 180, 6).toString(),

  word: () => randomItem(words),

  sentence: () => {
    const sentenceWords = Array.from({ length: randomInt(6, 12) }, () => randomItem(words));
    const content = sentenceWords.join(" ");
    return content.charAt(0).toUpperCase() + content.slice(1) + ".";
  },

  paragraph: () => {
    const sentences = Array.from({ length: randomInt(3, 5) }, () => {
      const sentenceWords = Array.from({ length: randomInt(6, 14) }, () => randomItem(words));
      const content = sentenceWords.join(" ");
      return content.charAt(0).toUpperCase() + content.slice(1) + ".";
    });
    return sentences.join(" ");
  },

  hexColor: () => `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,

  companyName: () => `${randomItem(companyPrefixes)} ${randomItem(companySuffixes)}`,

  jobTitle: () => `${randomItem(jobLevels)} ${randomItem(jobFields)}`,

  price: (field) => {
    let min = 10;
    let max = 1000;
    if (field.options) {
      const parts = field.options.split(",").map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
      if (parts.length >= 2) {
        min = parts[0];
        max = parts[1];
      } else if (parts.length === 1) {
        max = parts[0];
      }
    }
    return randomFloat(min, max, 2).toString();
  },

  currency: () => randomItem(currencies),

  creditCard: () => {
    const brand = randomItem(["4111", "5100", "3400", "6011"]);
    const suffix = randomInt(1000, 9999);
    return `${brand}-XXXX-XXXX-${suffix}`;
  },

  ipv4: () => `${randomInt(1, 254)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`,

  ipv6: () => Array.from({ length: 8 }, () => randomInt(0, 65535).toString(16)).join(":"),

  macAddress: () => Array.from({ length: 6 }, () => randomInt(0, 255).toString(16).padStart(2, "0").toUpperCase()).join(":"),

  domain: () => `${randomItem(companyPrefixes).toLowerCase()}${randomItem([".com", ".io", ".dev", ".net", ".org"])}`,

  url: (field, context) => `https://www.${generators.domain(field, context)}/home`,

  userAgent: () => randomItem(userAgents),

  date: () => {
    const start = new Date(2020, 0, 1).getTime();
    const end = new Date().getTime();
    return new Date(start + Math.random() * (end - start)).toISOString();
  },

  time: () => {
    const h = randomInt(0, 23).toString().padStart(2, "0");
    const m = randomInt(0, 59).toString().padStart(2, "0");
    const s = randomInt(0, 59).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  },

  timestamp: () => Math.floor((new Date(2020, 0, 1).getTime() + Math.random() * (new Date().getTime() - new Date(2020, 0, 1).getTime())) / 1000).toString(),

  number: (field) => {
    let min = 0;
    let max = 100;
    if (field.options) {
      const parts = field.options.split(",").map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      if (parts.length >= 2) {
        min = parts[0];
        max = parts[1];
      } else if (parts.length === 1) {
        max = parts[0];
      }
    }
    return randomInt(min, max);
  },

  boolean: (field) => {
    let probability = 0.5;
    if (field.options) {
      const prob = parseFloat(field.options.trim());
      if (!isNaN(prob) && prob >= 0 && prob <= 1) {
        probability = prob;
      }
    }
    return Math.random() < probability;
  },

  customArray: (field) => {
    const opts = field.options?.split(",").map(s => s.trim()).filter(s => s) || ["item1", "item2"];
    return randomItem(opts);
  }
};

// --- Presets ---
export const presets: SchemaPreset[] = [
  {
    name: "SaaS User Accounts",
    description: "Authentication details, roles, and status fields",
    tableName: "users",
    fields: [
      { id: "saas-1", name: "id", type: "uuid" },
      { id: "saas-2", name: "full_name", type: "fullName" },
      { id: "saas-3", name: "email", type: "email" },
      { id: "saas-4", name: "role", type: "role" },
      { id: "saas-5", name: "avatar", type: "avatarUrl" },
      { id: "saas-6", name: "status", type: "customArray", options: "Active, Pending, Suspended" },
      { id: "saas-7", name: "joined_at", type: "date" }
    ]
  },
  {
    name: "E-Commerce Transaction Logs",
    description: "Client billing info, payment types, pricing and purchase items",
    tableName: "orders",
    fields: [
      { id: "ecom-1", name: "invoice_no", type: "id" },
      { id: "ecom-2", name: "customer", type: "fullName" },
      { id: "ecom-3", name: "item", type: "customArray", options: "MacBook Pro, iPhone 15, AirPods Max, iPad Air, Studio Display" },
      { id: "ecom-4", name: "amount", type: "price", options: "99, 2499" },
      { id: "ecom-5", name: "currency", type: "currency" },
      { id: "ecom-6", name: "credit_card", type: "creditCard" },
      { id: "ecom-7", name: "shipping_zip", type: "zipCode" }
    ]
  },
  {
    name: "Server HTTP Access Logs",
    description: "API routing registries, HTTP methods, client IPs, response codes, and latencies",
    tableName: "api_logs",
    fields: [
      { id: "log-1", name: "timestamp", type: "timestamp" },
      { id: "log-2", name: "ip_address", type: "ipv4" },
      { id: "log-3", name: "method", type: "customArray", options: "GET, POST, PUT, DELETE" },
      { id: "log-4", name: "endpoint", type: "url" },
      { id: "log-5", name: "status_code", type: "customArray", options: "200, 201, 400, 401, 403, 404, 500" },
      { id: "log-6", name: "latency_ms", type: "number", options: "10, 450" }
    ]
  },
  {
    name: "Staff Directories",
    description: "Corporate office directory with jobs, office locators, and details",
    tableName: "employees",
    fields: [
      { id: "emp-1", name: "badge_id", type: "id" },
      { id: "emp-2", name: "full_name", type: "fullName" },
      { id: "emp-3", name: "job_title", type: "jobTitle" },
      { id: "emp-4", name: "company", type: "companyName" },
      { id: "emp-5", name: "phone_no", type: "phone" },
      { id: "emp-6", name: "city", type: "city" },
      { id: "emp-7", name: "email_address", type: "email" }
    ]
  }
];

// --- Formatters ---
export function formatAsJSON(data: any[]): string {
  return JSON.stringify(data, null, 2);
}

export function formatAsCSV(data: any[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const csvRows = data.map(row =>
    headers.map(h => {
      let val = row[h];
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(",")
  );
  return [headers.join(","), ...csvRows].join("\n");
}

export function formatAsSQL(data: any[], tableName: string): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const statements = data.map(row => {
    const values = headers.map(h => {
      let val = row[h];
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (val === null || val === undefined) return 'NULL';
      return val;
    });
    return `INSERT INTO ${tableName} (${headers.map(h => `\`${h}\``).join(", ")}) VALUES (${values.join(", ")});`;
  });
  return statements.join("\n");
}
