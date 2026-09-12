/**
 * Privacy Policy page.
 */
import { motion } from 'framer-motion';
import { FiArrowLeft, FiShield } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import './Legal.css';

const sections = [
  {
    title: '1. Information We Collect',
    body: [
      'When you use Smart Timetable, we may collect the following categories of information:',
    ],
    list: [
      'Account information: your name, email address, phone number, college, and department.',
      'Uploaded data: institutional information such as classes, faculty, subjects, rooms, and scheduling constraints that you provide to generate timetables.',
      'Usage data: technical information such as pages visited, features used, and device or browser details to improve the service.',
    ],
  },
  {
    title: '2. How We Use Your Information',
    body: [
      'We use the information we collect to provide, maintain, and improve the service, including:',
    ],
    list: [
      'Generating, previewing, and exporting your timetables.',
      'Managing your account and authenticating your identity.',
      'Communicating important updates, support, and service notifications.',
      'Analyzing usage patterns to enhance performance and user experience.',
      'Protecting the security and integrity of the platform.',
    ],
  },
  {
    title: '3. Data Storage and Security',
    body: [
      'We implement reasonable technical and organizational safeguards to protect your information against unauthorized access, alteration, disclosure, or destruction.',
      'While we strive to use commercially acceptable means to protect your data, no method of transmission over the internet or method of electronic storage is 100% secure.',
    ],
  },
  {
    title: '4. Sharing of Information',
    body: [
      'We do not sell, rent, or trade your personal information to third parties.',
      'We may share information with trusted service providers who assist us in operating the platform, and only to the extent necessary to provide the service. We may also disclose information where required by law or to protect the rights, property, and safety of our users and the public.',
    ],
  },
  {
    title: '5. Cookies and Analytics',
    body: [
      'We may use cookies and similar technologies to keep you signed in, remember your preferences, and understand how the service is used. You can configure your browser to refuse cookies, though some features may not function properly without them.',
    ],
  },
  {
    title: '6. Your Rights',
    body: [
      'You have the right to access, correct, or delete the personal information we hold about you. To exercise these rights, contact us using the details below, and we will respond within a reasonable timeframe.',
    ],
  },
  {
    title: '7. Data Retention',
    body: [
      'We retain your information only as long as necessary to provide the service and fulfill the purposes described in this policy, unless a longer retention period is required or permitted by law.',
    ],
  },
  {
    title: '8. Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. We encourage you to review this policy periodically.',
    ],
  },
  {
    title: '9. Contact Us',
    body: [
      'If you have any questions or concerns about this Privacy Policy or your personal information, please contact us at support@smarttimetable.app.',
    ],
  },
];

export default function Privacy() {
  return (
    <div className="page-wrapper">
      <div className="container">
        <motion.div
          className="legal-page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="page-header text-center">
            <h1>Privacy Policy</h1>
            <p>Smart Timetable - How we collect, use, and protect your data.</p>
          </div>

          <div className="legal-hero">
            <div className="legal-hero-icon">
              <FiShield size={22} />
            </div>
            <div>
              <h2>Privacy Policy</h2>
              <p>Last updated: August 2026</p>
            </div>
            <Link to="/" className="legal-back">
              <FiArrowLeft size={15} /> Back to Home
            </Link>
          </div>

          <div className="legal-sections">
            {sections.map((section, i) => (
              <motion.div
                key={i}
                className="legal-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
              >
                <h3>{section.title}</h3>
                {section.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                {section.list && (
                  <ul className="legal-list">
                    {section.list.map((li, j) => (
                      <li key={j}>{li}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}
          </div>

          <div className="legal-footer">
            <p>&copy; {new Date().getFullYear()} Smart Timetable. All rights reserved.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
