import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiGithub, FiLinkedin, FiTwitter, FiMail,
} from 'react-icons/fi';
import BrandLogo from '../BrandLogo/BrandLogo';
import './LandingFooter.css';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#', badge: 'Coming Soon' },
    { label: 'Documentation', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  resources: [
    { label: 'API', href: '#' },
    { label: 'User Guide', href: '#' },
    { label: 'Support', href: '#' },
    { label: 'Community', href: '#' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '#' },
    { label: 'Careers', href: '#', badge: 'Coming Soon' },
    { label: 'Blog', href: '#' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '#' },
  ],
};

const socialLinks = [
  { icon: FiGithub, href: '#', label: 'GitHub' },
  { icon: FiLinkedin, href: '#', label: 'LinkedIn' },
  { icon: FiTwitter, href: '#', label: 'Twitter' },
  { icon: FiMail, href: '#', label: 'Email' },
];

export default function LandingFooter() {
  return (
    <footer className="lfooter">
      <div className="lfooter-glow" />
      <div className="lfooter-inner">
        <div className="lfooter-top">
          <div className="lfooter-brand">
            <BrandLogo className="lfooter-logo" variant="light" size="md" />
            <p className="lfooter-desc">
              AI-powered automatic timetable generation for educational institutions.
              Conflict-free, optimized scheduling in seconds.
            </p>
            <div className="lfooter-social">
              {socialLinks.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    className="lfooter-social-link"
                    aria-label={s.label}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="lfooter-columns">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category} className="lfooter-col">
                <h4 className="lfooter-col-title">{category}</h4>
                <ul className="lfooter-col-links">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('/') ? (
                        <Link to={link.href} className="lfooter-link">
                          {link.label}
                          {link.badge && (
                            <span className="lfooter-badge">{link.badge}</span>
                          )}
                        </Link>
                      ) : (
                        <a href={link.href} className="lfooter-link">
                          {link.label}
                          {link.badge && (
                            <span className="lfooter-badge">{link.badge}</span>
                          )}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="lfooter-divider" />

        <div className="lfooter-bottom">
          <p className="lfooter-copyright">
            &copy; {new Date().getFullYear()} Smart Timetable. All rights reserved.
          </p>
          <p className="lfooter-tech">
            Made with React + FastAPI &middot; v1.0.0
          </p>
        </div>
      </div>
    </footer>
  );
}
