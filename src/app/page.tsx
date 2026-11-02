import Link from "next/link";
import { Accessibility, ArrowDown, ArrowRight, ArrowUpRight, Check, Compass, Footprints, Layers3, MoveUpRight, Navigation, ShieldCheck, TrainFront } from "lucide-react";
import { StationMap } from "@/components/station-map";
import { findRoute } from "@/lib/navigation/engine";
import { demoStation } from "@/lib/station/demo-station";

export default function HomePage() {
  const previewRoute = findRoute(demoStation, "gate-1", "p10-destination");
  return (
    <main className="landing-page">
      <header className="app-header landing-header">
        <Link href="/" className="brand" aria-label="RailNavi home"><span className="brand-icon"><TrainFront size={22} /></span>rail<span>navi</span><i /></Link>
        <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#built-for-everyone">Built for everyone</a></nav>
        <Link href="/demo" className="header-cta">Explore the demo <ArrowUpRight size={16} /></Link>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow"><span className="status-dot" />A CLEARER WAY THROUGH THE STATION</div>
          <h1>Find your way.<br /><span>Catch your train.</span></h1>
          <p className="hero-description">Big stations. New places. One less thing to worry about.<br className="desktop-break" /> Meet your personal guide from the entrance<br className="desktop-break" /> to the right platform.</p>
          <Link href="/demo" className="button button-dark hero-cta">Explore Demo Station <ArrowUpRight size={20} /></Link>
          <div className="hero-assurance"><ShieldCheck size={15} /><span>No sign-up. No location permissions. Just explore.</span></div>
          <div className="hero-stats"><div><strong>12<span> platforms</span></strong><small>Every platform connected</small></div><div><strong>3<span> levels</span></strong><small>A station with real depth</small></div><div><Accessibility size={23} /><strong className="stepfree-stat">Step-free<small>Routes for more people</small></strong></div></div>
        </div>
        <div className="hero-map-wrap">
          <div className="hero-map-top"><span><span className="status-dot" />RAILNAVI DEMO CENTRAL</span><span className="demo-badge">FICTIONAL STATION</span></div>
          <StationMap station={demoStation} floor={1} route={previewRoute} preview />
          <div className="hero-map-level"><Layers3 size={15} />Level +1 <span>Foot overbridges</span></div>
          <div className="hero-route-card"><span className="route-card-icon"><Navigation size={21} /></span><div><small>A LITTLE GUIDANCE GOES A LONG WAY</small><strong>Gate 1 <ArrowRight size={15} /> Platform 10</strong><p>Via Foot Overbridge A · {Math.ceil(previewRoute.durationSeconds / 60)} min walk</p></div><span className="route-card-check"><Check size={17} /></span></div>
          <div className="hero-map-caption"><span className="tiny-route-line" />A calculated route through our fictional demo station.</div>
        </div>
      </section>
      <section className="journey-band" id="how-it-works"><div><span className="eyebrow">LESS SEARCHING. MORE CERTAINTY.</span><h2>Your next platform.<br />In three simple steps.</h2></div><ol><li><span>01</span><MapPinIcon /><strong>Set your starting point</strong><p>Choose an entrance or a known station checkpoint.</p></li><li><span>02</span><Compass size={25} /><strong>Find your best route</strong><p>Shortest, fastest or step-free. Your journey, your choice.</p></li><li><span>03</span><Footprints size={25} /><strong>Follow clear directions</strong><p>Know which bridge, lift and walkway to take.</p></li></ol></section>
      <section className="everyone-section" id="built-for-everyone"><div className="everyone-sign"><span className="sign-symbol"><Accessibility size={36} /></span><div>EVERY JOURNEY<br /><strong>DESERVES A CLEAR PATH.</strong></div><MoveUpRight size={42} /></div><div><span className="eyebrow">THOUGHTFUL BY DESIGN</span><h2>Different needs.<br />The same destination.</h2><p>Travelling with a wheelchair? Avoiding stairs with heavy luggage? Choose a route that works for you, with clearly marked lifts, escalators and level changes.</p><Link href="/demo" className="text-button">Explore accessible navigation <ArrowRight size={16} /></Link></div></section>
      <footer className="landing-footer"><Link href="/" className="brand"><TrainFront size={20} />rail<span>navi</span></Link><p>A working proof of concept. Fictional station. Synthetic data.</p><Link href="/demo">Take a look around <ArrowUpRight size={15} /></Link></footer>
    </main>
  );
}
function MapPinIcon() {
  return <div className="journey-location"><ArrowDown size={24} /></div>;
}
