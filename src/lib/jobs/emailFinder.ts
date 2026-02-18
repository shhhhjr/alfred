import { env } from "@/lib/env";

export type ContactInfo = {
  name: string;
  email: string;
  title: string;
};

export type FindContactResult =
  | { success: true; contact: ContactInfo }
  | { success: false; error: "no_api_keys" | "not_found" | string };

export async function findContact(
  company: string,
  roleTitle?: string
): Promise<FindContactResult> {
  if (!env.HUNTER_API_KEY && !env.APOLLO_API_KEY) {
    return { success: false, error: "no_api_keys" };
  }

  const domain = extractDomain(company);

  if (env.HUNTER_API_KEY && domain) {
    try {
      const contact = await findWithHunter(domain, roleTitle);
      if (contact) return { success: true, contact };
    } catch {
      // Fall through to Apollo
    }
  }

  if (env.APOLLO_API_KEY) {
    try {
      const contact = await findWithApollo(company, roleTitle);
      if (contact) return { success: true, contact };
    } catch {
      // Return not_found if both fail
    }
  }

  return { success: false, error: "not_found" };
}

function extractDomain(company: string): string | null {
  const clean = company.toLowerCase().trim().replace(/\s+/g, " ");
  const commonDomains: Record<string, string> = {
    google: "google.com",
    microsoft: "microsoft.com",
    apple: "apple.com",
    amazon: "amazon.com",
    meta: "meta.com",
    facebook: "meta.com",
    linkedin: "linkedin.com",
    indeed: "indeed.com",
    stripe: "stripe.com",
    slack: "slack.com",
    airbnb: "airbnb.com",
    uber: "uber.com",
    netflix: "netflix.com",
    spotify: "spotify.com",
    salesforce: "salesforce.com",
    adobe: "adobe.com",
    oracle: "oracle.com",
    ibm: "ibm.com",
    hp: "hp.com",
    dell: "dell.com",
    intel: "intel.com",
    nvidia: "nvidia.com",
    tesla: "tesla.com",
    spacex: "spacex.com",
  };

  if (commonDomains[clean]) {
    return commonDomains[clean];
  }

  const domainMatch = clean.match(/\b([a-z0-9-]+\.(com|io|co|net|org|ai|app))\b/);
  if (domainMatch) {
    return domainMatch[1];
  }

  const words = clean.replace(/[,\.&]/g, "").split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const first = words[0].replace(/[^a-z0-9-]/g, "");
    if (first.length >= 2) {
      return `${first}.com`;
    }
  }

  return null;
}

async function findWithHunter(domain: string, roleTitle?: string): Promise<ContactInfo | null> {
  if (!env.HUNTER_API_KEY) return null;

  const params = new URLSearchParams({
    domain,
    api_key: env.HUNTER_API_KEY,
    limit: "10",
  });

  const response = await fetch(`https://api.hunter.io/v2/domain-search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Hunter API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    data?: {
      emails?: Array<{
        value: string;
        first_name?: string;
        last_name?: string;
        position?: string;
        seniority?: string;
      }>;
    };
  };

  const emails = data.data?.emails || [];
  if (emails.length === 0) return null;

  const targetRole = roleTitle?.toLowerCase() || "";
  const relevant = emails.find(
    (e) =>
      e.position &&
      (targetRole.includes("hiring") ||
        targetRole.includes("recruiter") ||
        targetRole.includes("talent") ||
        e.position.toLowerCase().includes("hiring") ||
        e.position.toLowerCase().includes("recruiter") ||
        e.position.toLowerCase().includes("talent") ||
        e.position.toLowerCase().includes("hr") ||
        e.seniority === "executive")
  );

  const contact = relevant || emails[0];
  return {
    name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Hiring Manager",
    email: contact.value,
    title: contact.position || "Hiring Manager",
  };
}

async function findWithApollo(company: string, roleTitle?: string): Promise<ContactInfo | null> {
  if (!env.APOLLO_API_KEY) return null;

  const searchQuery = roleTitle
    ? `${roleTitle} at ${company}`
    : `hiring manager ${company}`;

  const response = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": env.APOLLO_API_KEY,
    },
    body: JSON.stringify({
      q_keywords: searchQuery,
      per_page: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apollo API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    people?: Array<{
      first_name?: string;
      last_name?: string;
      email?: string;
      title?: string;
    }>;
  };

  const people = data.people || [];
  if (people.length === 0) return null;

  const person = people[0];
  if (!person.email) return null;

  return {
    name: `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Hiring Manager",
    email: person.email,
    title: person.title || "Hiring Manager",
  };
}
