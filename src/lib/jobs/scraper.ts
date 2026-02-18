import * as cheerio from "cheerio";

export type JobListing = {
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  description: string;
};

type ScrapeResult = {
  jobs: JobListing[];
  success: boolean;
  error?: string;
};

export async function scrapeIndeed(params: {
  keywords?: string;
  location?: string;
}): Promise<ScrapeResult> {
  try {
    const query = new URLSearchParams();
    if (params.keywords) query.set("q", params.keywords);
    if (params.location) query.set("l", params.location);
    query.set("start", "0");

    const url = `https://www.indeed.com/jobs?${query.toString()}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return { jobs: [], success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];

    $("div[data-jk]").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h2.jobTitle a span").text().trim() || $el.find("h2.jobTitle a").text().trim();
      const company = $el.find("span[data-testid='company-name']").text().trim() || $el.find(".companyName").text().trim();
      const location = $el.find("div[data-testid='text-location']").text().trim() || $el.find(".companyLocation").text().trim();
      const jobId = $el.attr("data-jk");
      const url = jobId ? `https://www.indeed.com/viewjob?jk=${jobId}` : "";
      const snippet = $el.find(".job-snippet").text().trim() || "";

      if (title && company && url) {
        jobs.push({
          title,
          company,
          location: location || "Remote",
          url,
          source: "indeed",
          description: snippet,
        });
      }
    });

    return { jobs: jobs.slice(0, 20), success: true };
  } catch (err) {
    return {
      jobs: [],
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function scrapeLinkedIn(params: {
  keywords?: string;
  location?: string;
}): Promise<ScrapeResult> {
  try {
    const query = new URLSearchParams();
    if (params.keywords) query.set("keywords", params.keywords);
    if (params.location) query.set("location", params.location);

    const url = `https://www.linkedin.com/jobs/search?${query.toString()}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return { jobs: [], success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];

    $("div.base-card").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h3.base-search-card__title").text().trim();
      const company = $el.find("h4.base-search-card__subtitle").text().trim();
      const location = $el.find(".job-search-card__location").text().trim();
      const link = $el.find("a.base-card__full-link");
      const href = link.attr("href") || "";
      const url = href.startsWith("http") ? href : href ? `https://www.linkedin.com${href}` : "";
      const snippet = $el.find(".job-search-card__snippet").text().trim() || "";

      if (title && company && url) {
        jobs.push({
          title,
          company,
          location: location || "Remote",
          url,
          source: "linkedin",
          description: snippet,
        });
      }
    });

    return { jobs: jobs.slice(0, 20), success: true };
  } catch (err) {
    return {
      jobs: [],
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function scrapeBoF(params: {
  keywords?: string;
}): Promise<ScrapeResult> {
  try {
    const url = "https://www.businessoffashion.com/careers/jobs/";
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return { jobs: [], success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const jobs: JobListing[] = [];

    $("article, .job-listing, .job-item").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h2, h3, .job-title, .title").first().text().trim();
      const company = $el.find(".company, .employer").text().trim() || "Business of Fashion";
      const location = $el.find(".location").text().trim() || "Remote";
      const link = $el.find("a").first();
      const href = link.attr("href");
      const url = href?.startsWith("http") ? href : href ? `https://www.businessoffashion.com${href}` : "";
      const snippet = $el.find(".description, .snippet, p").first().text().trim() || "";

      if (title && url) {
        const keywords = params.keywords?.toLowerCase() || "";
        if (!keywords || title.toLowerCase().includes(keywords) || snippet.toLowerCase().includes(keywords)) {
          jobs.push({
            title,
            company,
            location,
            url,
            source: "bof",
            description: snippet,
          });
        }
      }
    });

    return { jobs: jobs.slice(0, 20), success: true };
  } catch (err) {
    return {
      jobs: [],
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Sample jobs returned when scraping is blocked (Indeed/LinkedIn often return 403) */
const SAMPLE_JOBS: JobListing[] = [
  { title: "Software Engineer", company: "Tech Corp", location: "San Francisco, CA", url: "https://www.indeed.com/viewjob?jk=sample1", source: "indeed", description: "Build scalable applications. Experience with React and Node.js preferred." },
  { title: "Full Stack Developer", company: "Startup Inc", location: "Remote", url: "https://www.linkedin.com/jobs/view/sample1", source: "linkedin", description: "Join our growing team. Python, JavaScript, cloud experience." },
  { title: "Product Manager", company: "Product Co", location: "New York, NY", url: "https://www.indeed.com/viewjob?jk=sample2", source: "indeed", description: "Drive product strategy and roadmap." },
];

export async function scrapeAllJobs(params: {
  keywords?: string;
  location?: string;
  jobTitle?: string;
}): Promise<{ jobs: JobListing[]; sources: { name: string; success: boolean; error?: string; count: number }[] }> {
  const searchKeywords = params.jobTitle || params.keywords || "";
  const allJobs: JobListing[] = [];
  const sources: { name: string; success: boolean; error?: string; count: number }[] = [];

  const [indeed, linkedin, bof] = await Promise.all([
    scrapeIndeed({ keywords: searchKeywords, location: params.location }),
    scrapeLinkedIn({ keywords: searchKeywords, location: params.location }),
    scrapeBoF({ keywords: searchKeywords }),
  ]);

  if (indeed.success && indeed.jobs.length > 0) {
    allJobs.push(...indeed.jobs);
    sources.push({ name: "Indeed", success: true, count: indeed.jobs.length });
  } else {
    sources.push({ name: "Indeed", success: false, error: indeed.error ?? "Blocked or no results", count: 0 });
  }

  if (linkedin.success && linkedin.jobs.length > 0) {
    allJobs.push(...linkedin.jobs);
    sources.push({ name: "LinkedIn", success: true, count: linkedin.jobs.length });
  } else {
    sources.push({ name: "LinkedIn", success: false, error: linkedin.error ?? "Blocked or no results", count: 0 });
  }

  if (bof.success && bof.jobs.length > 0) {
    allJobs.push(...bof.jobs);
    sources.push({ name: "Business of Fashion", success: true, count: bof.jobs.length });
  } else {
    sources.push({ name: "Business of Fashion", success: false, error: bof.error ?? "Blocked or no results", count: 0 });
  }

  if (allJobs.length === 0) {
    allJobs.push(...SAMPLE_JOBS.map((j) => ({ ...j, description: j.description + (searchKeywords ? ` (Search: ${searchKeywords})` : "") })));
    sources.push({ name: "Sample (scraping blocked)", success: true, count: SAMPLE_JOBS.length });
  }

  return { jobs: allJobs, sources };
}
