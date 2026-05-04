"use client";

import { useEffect, useRef, useState } from "react";

type FormStatus = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [navOpen, setNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handler = () => {
      document
        .querySelector(".topbar")
        ?.classList.toggle("topbar--scrolled", window.scrollY > 80);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Scroll spy — track which section occupies the upper viewport
  useEffect(() => {
    const sectionIds = ["features", "mission", "compare", "signup"];
    const trigger = window.innerHeight * 0.35;

    const handler = () => {
      let active = "";
      let closestDist = Infinity;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= trigger && rect.bottom > 0) {
          const dist = trigger - rect.top;
          if (dist < closestDist) {
            closestDist = dist;
            active = id;
          }
        }
      }
      setActiveSection(active);
    };

    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  // Scroll-triggered reveals
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".will-reveal")
    );

    if (!elements.length) return;

    if (typeof IntersectionObserver === "undefined") {
      elements.forEach((el) => el.classList.add("revealed"));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("revealed");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormStatus("loading");
    setFormErrors({});
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        if (data.fields?.length) {
          const errs: Record<string, string> = {};
          (data.fields as string[]).forEach((f) => {
            errs[f] = "Required";
          });
          setFormErrors(errs);
          setFormStatus("idle");
          return;
        }
      }
      if (!res.ok) throw new Error("server");
      setFormStatus("success");
    } catch {
      setFormStatus("error");
    }
  }

  function resetForm() {
    setFormStatus("idle");
    setFormErrors({});
    formRef.current?.reset();
  }

  const navLinks: [string, string][] = [
    ["#features", "Modules"],
    ["#mission", "Mission"],
    ["#compare", "Compare"],
    ["#signup", "Request Access"],
  ];

  return (
    <>
      {/* MOBILE NAV OVERLAY */}
      {navOpen && (
        <div className="nav-overlay" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            className="nav-overlay-close"
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
          <nav aria-label="Mobile navigation">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setNavOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="nav-overlay-cta">
            <a href="#signup" className="btn btn-primary" onClick={() => setNavOpen(false)}>
              Request Access
            </a>
          </div>
        </div>
      )}

      {/* HERO */}
      <div className="hero">
        <div className="hero-bg" />

        <header className="topbar">
          <a className="brand" href="#">
            <div className="brand-mark">H</div>
            <div className="brand-word">
              Halligan
            </div>
          </a>
          <nav className="nav" aria-label="Primary navigation">
            {navLinks.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className={activeSection === href.slice(1) ? "nav-active" : ""}
                aria-current={activeSection === href.slice(1) ? "true" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="top-cta">
            <a href="#signup" className="btn btn-primary">
              Request Access
            </a>
          </div>
          <button
            className="nav-toggle"
            type="button"
            aria-label={navOpen ? "Close menu" : "Open menu"}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        {/* HERO GRID */}
        <section className="hero-grid">
          <div>
            <div className="hero-eyebrow">
              <span className="pip" />
              <span>NERIS-ready</span>
            </div>
            <h1>
              Records
              <br />
              management
              <br />
              <span className="accent">that won&apos;t tax</span>
              <br />
              the duty fund.
            </h1>
            <p className="lede">
              Halligan is the records system for volunteer and combination departments who got priced out of the legacy
              giants. NERIS incident reporting, rosters, training, hydrants, gear &amp; apparatus — one tool, one fair
              price.
            </p>
            <div className="hero-actions">
              <a href="#signup" className="btn btn-primary">
                Request Early Access →
              </a>
              <a href="#signup" className="btn btn-ghost">
                Talk to the Team
              </a>
            </div>
            <dl className="hero-meta">
              <div>
                <dt>Pricing</dt>
                <dd>From $300 / yr</dd>
              </div>
              <div>
                <dt>Setup</dt>
                <dd>4 hours</dd>
              </div>
            </dl>
          </div>

          {/* MOCKUP */}
          <div className="mockup-stage">
            <div className="mockup mockup-laptop">
              <div className="ui">
                <div className="ui-titlebar">
                  <div className="lights">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>HALLIGAN · Station 14</span>
                  <span className="crumbs">/ incidents / current shift</span>
                  <div className="right">
                    <span className="pill">ON DUTY</span>
                    <span>14:32 EST</span>
                  </div>
                </div>
                <aside className="ui-side">
                  <div className="item active sq">
                    <span className="ic" />
                    INC
                  </div>
                  <div className="item cir">
                    <span className="ic" />
                    RST
                  </div>
                  <div className="item bar">
                    <span className="ic" />
                    TRN
                  </div>
                  <div className="item dia">
                    <span className="ic" />
                    HYD
                  </div>
                  <div className="item tri">
                    <span className="ic" />
                    APP
                  </div>
                </aside>
                <main className="ui-main">
                  <div className="ui-row">
                    <div className="ui-h">Incidents — This Shift</div>
                    <div className="ui-tabs">
                      <span className="on">All</span>
                      <span>Open</span>
                      <span>Cleared</span>
                      <span>NERIS</span>
                    </div>
                  </div>
                  {[
                    {
                      num: "26-0418",
                      desc: "Structure / Single-family",
                      sub: "418 W. Birch St — Smoke from attic",
                      tag: "fire",
                      tagLabel: "Fire",
                      stamp: "14:08 · Eng 14, L7",
                      status: "On Scene",
                      cleared: false,
                    },
                    {
                      num: "26-0417",
                      desc: "EMS / 51-y/o male",
                      sub: "RR-12 Mile 88 — Chest pain",
                      tag: "ems",
                      tagLabel: "EMS",
                      stamp: "13:46 · M14",
                      status: "Cleared",
                      cleared: true,
                    },
                    {
                      num: "26-0416",
                      desc: "Hazard / Wires down",
                      sub: "Co. Rd 9 & 4th — Tree on lines",
                      tag: "haz",
                      tagLabel: "Haz",
                      stamp: "12:11 · Eng 14",
                      status: "Cleared",
                      cleared: true,
                    },
                    {
                      num: "26-0415",
                      desc: "Service / Lift assist",
                      sub: "2014 Cedar Ln — Resident fall",
                      tag: "svc",
                      tagLabel: "Svc",
                      stamp: "10:34 · M14",
                      status: "Cleared",
                      cleared: true,
                    },
                    {
                      num: "26-0414",
                      desc: "Mutual Aid / Brush",
                      sub: "Co. Rt 22 — Box alarm w/ Twp 6",
                      tag: "fire",
                      tagLabel: "Fire",
                      stamp: "08:02 · BR-3",
                      status: "Cleared",
                      cleared: true,
                    },
                  ].map((inc) => (
                    <div className="ui-incident-row" key={inc.num}>
                      <span className="num">{inc.num}</span>
                      <span className="desc">
                        {inc.desc}
                        <small>{inc.sub}</small>
                      </span>
                      <span>
                        <span className={`ui-tag ${inc.tag}`}>{inc.tagLabel}</span>
                      </span>
                      <span className="stamp">{inc.stamp}</span>
                      <span className={`ui-status${inc.cleared ? " cleared" : ""}`}>
                        {inc.status}
                      </span>
                    </div>
                  ))}
                </main>
              </div>
            </div>

            <div className="mockup mockup-tablet">
              <div className="ui-tab">
                <div className="row">
                  <h4>B-Shift Roster</h4>
                  <span className="date">SAT · 05/03</span>
                </div>
                <div className="roster">
                  {[
                    { unit: "Eng 14", name: "Ortega, M.", role: "FF/EMT · OIC", type: "engine" },
                    { unit: "Eng 14", name: "Briggs, T.", role: "FF · Driver", type: "engine" },
                    { unit: "Eng 14", name: "Reilly, A.", role: "FF · Probie", type: "engine" },
                    { unit: "Med 14", name: "Park, S.", role: "PARAMEDIC", type: "ems" },
                    { unit: "Med 14", name: "Hale, J.", role: "EMT-B", type: "ems" },
                    { unit: "Lad 7", name: "— OPEN —", role: "SEEKING SWAP", type: "" },
                  ].map((c, i) => (
                    <div className={`crew${c.type ? ` ${c.type}` : ""}`} key={i}>
                      <h5>{c.unit}</h5>
                      <div className="name">{c.name}</div>
                      <div className="role">{c.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TICKER */}
        <div className="ticker">
          <div className="ticker-inner wrap">
            <span>NFIRS / NERIS Crosswalk</span>
            <span className="sep">×</span>
            <span>SOC 2 In Progress</span>
            <span className="sep">×</span>
            <span>USDA Rural Grant Eligible</span>
            <span className="sep">×</span>
            <span>HIPAA-aligned EMS</span>
            <span className="sep">×</span>
            <span>Built for the Volunteer House</span>
          </div>
        </div>
      </div>

      {/* MISSION */}
      <section className="mission" id="mission">
        <div className="wrap mission-grid">
          <div className="will-reveal">
            <div className="section-tag">Mission · 01</div>
            <h2>The duty isn&apos;t optional. The software shouldn&apos;t be either.</h2>
          </div>
          <div
            className="body will-reveal"
            style={{ "--delay": "100ms" } as React.CSSProperties}
          >
            <p>
              Three quarters of the country&apos;s fire service is volunteer. Most of those departments are running
              calls on radios older than the youngest probie, and writing reports in spreadsheets because the
              &quot;industry-standard&quot; RMS wants $14,000 a year up front — paid to a software company that just got
              bought by its third private-equity owner this decade.
            </p>
            <p>
              Halligan is records management software for the houses the giants stopped serving: volunteer companies,
              small combination departments, county districts, wildland teams. We work shoulder-to-shoulder with the
              chiefs and records officers who actually use this stuff — every feature ships only after a real department
              has run it through a tour. NERIS-ready from day one. Fair-priced for
              every house.
            </p>
            <p>We aren&apos;t trying to disrupt the fire service. We&apos;re trying to keep it answering the bell.</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features" id="features">
        <div className="wrap">
          <div className="features-head">
            <div className="will-reveal">
              <div className="section-tag">Modules · 02</div>
              <h2>
                Every module
                <br />a department
                <br />
                actually uses.
              </h2>
            </div>
            <p
              className="will-reveal"
              style={{ "--delay": "70ms" } as React.CSSProperties}
            >
              No bloat. No &quot;AI assistants.&quot; Just the records you have to keep, the reports you have to file,
              and the rosters that keep crews on the rig. Designed alongside the departments that depend on them.
            </p>
          </div>
          <div className="feature-grid">
            {[
              {
                num: "01 / NERIS",
                title: "Incident Reporting",
                desc: "Full NERIS data model with NFIRS crosswalk for legacy reporting. Auto-pulls from CAD, geocodes addresses, files to the state in two clicks.",
                badge: null,
                amber: false,
              },
              {
                num: "02 / DUTY",
                title: "Roster & Scheduling",
                desc: "Shift swaps, point systems, attendance tracking, mutual aid logging. Built for volunteer pages and combination duty crews alike.",
                badge: null,
                amber: true,
              },
              {
                num: "03 / TRN",
                title: "Training & ISO Drills",
                desc: "NFPA 1410 evolutions, hours per member, certifications expiring this quarter, and a printable audit packet for your ISO evaluator.",
                badge: null,
                amber: false,
              },
              {
                num: "04 / RIG",
                title: "Apparatus & Gear",
                desc: "Daily checks, hose testing, SCBA flow tests, NFPA 1851 turnout-gear lifecycle. Out-of-service flags follow the truck across modules.",
                badge: null,
                amber: true,
              },
              {
                num: "05 / HYD",
                title: "Hydrants & Pre-plans",
                desc: "GIS hydrant inspections, flow data, target-hazard pre-plans. Tablet-friendly in the cab. Offline first when service drops on rural roads.",
                badge: null,
                amber: false,
              },
              {
                num: "06 / EMS",
                title: "EMS & Patient Care",
                desc: "NEMSIS 3.5 reports, protocols, controlled-substance log. HIPAA-aligned. Imports from major monitor brands so you don't double-chart.",
                badge: null,
                amber: true,
              },
            ].map((f, i) => (
              <div
                className={`feature${f.amber ? " amber" : ""} will-reveal`}
                key={f.num}
                style={{ "--delay": `${i * 55}ms` } as React.CSSProperties}
              >
                <div className="num">{f.num}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                {f.badge && <span className="badge">{f.badge}</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section className="callout" id="compare">
        <div className="wrap">
          <div className="callout-card">
            <div className="will-reveal">
              <div className="section-tag">Compare · 03</div>
              <h2>The honest comparison.</h2>
              <p>
                We&apos;re not going to tell you the giants are bad software. They&apos;re not. They&apos;re just
                expensive software, sold by sales orgs that haven&apos;t run a call this decade. Here&apos;s what the
                line items actually look like for a 22-member volunteer house.
              </p>
            </div>
            <div
              className="compare will-reveal"
              style={{ "--delay": "90ms" } as React.CSSProperties}
            >
              <div className="compare-col">
                <h4>Legacy RMS</h4>
                <ul>
                  {[
                    "$11,400 / yr base",
                    "$2,200 implementation",
                    "$95 / module add-on",
                    "3-year contract",
                    "Ticket SLA: 5 biz days",
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="compare-col us">
                <h4>Halligan</h4>
                <ul>
                  {[
                    "$300 / yr · <25 members",
                    "$500 / yr · 26–60",
                    "All modules included",
                    "Month-to-month",
                    "Ticket SLA: same shift",
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SIGNUP */}
      <section className="signup" id="signup">
        <div className="wrap">
          <div className="pricing-strip will-reveal">
            <div>
              <span>Under 25 members</span>
              <strong>$300 / yr</strong>
            </div>
            <div>
              <span>25–60 members</span>
              <strong>$500 / yr</strong>
            </div>
            <div>
              <span>60+ members</span>
              <strong>Contact us</strong>
            </div>
          </div>
        </div>
        <div className="wrap signup-grid">
          <div className="will-reveal">
            <div className="section-tag">Request Access · 04</div>
            <h2>
              Get on the
              <br />
              early access list.
            </h2>
            <p className="lede">
              We&apos;re onboarding departments in the order requests come in. Get on the list today, and we&apos;ll be in touch within 24 hours.
            </p>
            <dl className="signup-meta">
              <div>
                <dt>Email</dt>
                <dd>team@tryhalligan.com</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href="tel:+3102808717">(310) 280-8717</a>
                </dd>
              </div>
              <div>
                <dt>HQ</dt>
                <dd>Irvine, CA</dd>
              </div>
              <div>
                <dt>Response</dt>
                <dd>&lt; 24 hours</dd>
              </div>
            </dl>
          </div>

          <form
            className="form-card will-reveal"
            onSubmit={handleSubmit}
            ref={formRef}
            noValidate
            style={{ "--delay": "90ms" } as React.CSSProperties}
          >
            <h3>Request Access</h3>
            <p className="sub">No credit card. No demo gauntlet. A real human on our team reads every one.</p>

            <div className="form-row">
              <div className="field">
                <label htmlFor="first-name">First Name</label>
                <input id="first-name" name="firstName" type="text" required placeholder="Jamie" />
                {formErrors.firstName && (
                  <span className="field-err" role="alert">
                    {formErrors.firstName}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="last-name">Last Name</label>
                <input id="last-name" name="lastName" type="text" required placeholder="Briggs" />
                {formErrors.lastName && (
                  <span className="field-err" role="alert">
                    {formErrors.lastName}
                  </span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="dept">Department</label>
                <input id="dept" name="department" type="text" required placeholder="Hose Co. No. 4" />
                {formErrors.department && (
                  <span className="field-err" role="alert">
                    {formErrors.department}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="rank">Rank / Role</label>
                <input id="rank" name="rank" type="text" placeholder="Chief, Captain, Records Officer…" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="dept-email">Department Email</label>
                <input id="dept-email" name="email" type="email" required placeholder="chief@dept.org" />
                {formErrors.email && (
                  <span className="field-err" role="alert">
                    {formErrors.email}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" name="phone" type="tel" placeholder="(000) 000-0000" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="dept-type">Department Type</label>
                <select id="dept-type" name="deptType" required>
                  <option value="volunteer">Volunteer</option>
                  <option value="combination">Combination</option>
                  <option value="career-small">Career — under 50 personnel</option>
                  <option value="county">County / District</option>
                  <option value="wildland">Wildland / Forestry</option>
                </select>
                {formErrors.deptType && (
                  <span className="field-err" role="alert">
                    {formErrors.deptType}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="roster-size">Roster Size</label>
                <select id="roster-size" name="rosterSize" required>
                  <option value="under-25">Under 25</option>
                  <option value="25-60">25–60</option>
                  <option value="60-150">60–150</option>
                  <option value="150+">150+</option>
                </select>
                {formErrors.rosterSize && (
                  <span className="field-err" role="alert">
                    {formErrors.rosterSize}
                  </span>
                )}
              </div>
            </div>

            <div className="form-row full">
              <div className="field">
                <label htmlFor="pain-point">What&apos;s your current RMS?</label>
                <textarea
                  id="pain-point"
                  name="painPoint"
                  placeholder="Spreadsheets. Old NFIRS app. Vendor we can't afford anymore. Whatever it is — tell us."
                />
              </div>
            </div>

            <label className="check">
              <input type="checkbox" name="callOk" />
              <span>
                I consent to being contacted by a real human on the Halligan team about my request. (We promise not to spam or sell your info.)
              </span>
            </label>

            <div className="form-submit">
              <button
                type="submit"
                className="btn btn-block"
                disabled={formStatus === "loading" || formStatus === "success"}
              >
                {formStatus === "loading" ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    Sending…
                  </>
                ) : formStatus === "success" ? (
                  "On the board ✓"
                ) : (
                  "Submit Request →"
                )}
              </button>
            </div>

            {formStatus === "success" && (
              <div className="form-success">
                <p>You&apos;ll hear from us within one shift. We read every request personally.</p>
                <p>
                  Direct line: <a href="mailto:team@tryhalligan.com">team@tryhalligan.com</a>
                </p>
                <button type="button" className="btn-reset" onClick={resetForm}>
                  Submit another request →
                </button>
              </div>
            )}

            {formStatus === "error" && (
              <div className="form-error-banner" role="alert">
                Something went wrong on our end — try again, or reach us directly at{" "}
                <a href="mailto:team@tryhalligan.com">team@tryhalligan.com</a>.
                <button type="button" onClick={resetForm}>
                  Try again
                </button>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot">
              <a className="brand" href="#">
                <div className="brand-mark">H</div>
                <div className="brand-word">
                  Halligan
                </div>
              </a>
              <p className="foot-blurb">
                Records management software built for volunteer and small-budget fire departments.
              </p>
            </div>
            <div className="foot">
              <h5>Modules</h5>
              <ul>
                {[
                  "Incidents (NERIS)",
                  "Roster & Duty",
                  "Training",
                  "Apparatus & Gear",
                  "Hydrants & Pre-plans",
                  "EMS / NEMSIS",
                ].map((item) => (
                  <li key={item}>
                    <a href="#">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="foot">
              <h5>Department</h5>
              <ul>
                {([
                  ["Mission", "#mission"],
                  ["Pricing", "#signup"],
                  ["Compare", "#compare"],
                  ["Request Access", "#signup"],
                ] as [string, string][]).map(([label, href]) => (
                  <li key={label}>
                    <a href={href}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="foot">
              <h5>Contact</h5>
              <ul>
                {[
                  "team@tryhalligan.com",
                  "Request Access",
                  "Security",
                ].map((item) => (
                  <li key={item}>
                    <a href="#">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Halligan · All rights reserved.</span>
            <span>v2026.05 · NERIS-ready</span>
          </div>
        </div>
      </footer>
    </>
  );
}
