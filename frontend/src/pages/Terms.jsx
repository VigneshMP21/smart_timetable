/**
 * Terms of Service page.
 */
import { motion } from 'framer-motion';
import { FiArrowLeft, FiFileText } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import './Legal.css';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: [
      'By creating an account or using the Smart Timetable platform, you agree to be bound by these Terms of Service. If you do not agree to any part of these terms, you may not use the service.',
    ],
  },
  {
    title: '2. Description of Service',
    body: [
      'Smart Timetable is a web-based platform that automatically generates conflict-free timetables for educational institutions. Users upload institutional data (classes, faculty, subjects, rooms, and constraints) and the platform produces optimized schedules that can be previewed and exported in PDF or Excel formats.',
      'The service is provided for informational and operational purposes only and should be reviewed for accuracy before final use.',
    ],
  },
  {
    title: '3. Accounts and Registration',
    body: [
      'To use certain features, you must create an account. You agree to provide accurate, current, and complete information during registration and to keep your account credentials secure.',
      'Accounts are created with a default role of "user". Role changes are handled by administrators. You are responsible for all activity that occurs under your account.',
    ],
  },
  {
    title: '4. Acceptable Use',
    body: [
      'You agree not to misuse the platform, including but not limited to:',
    ],
    list: [
      'Uploading unlawful, fraudulent, or unauthorized data.',
      'Attempting to gain unauthorized access to other accounts or systems.',
      'Interfering with the proper functioning of the service.',
      'Using the service for any purpose other than legitimate timetable scheduling.',
    ],
  },
  {
    title: '5. User Content and Intellectual Property',
    body: [
      'You retain ownership of the data you upload to the platform. By uploading data, you grant Smart Timetable a limited license to store, process, and use that data solely to provide and improve the service.',
      'The platform, including its software, design, and branding, is the property of Smart Timetable and is protected by applicable intellectual property laws.',
    ],
  },
  {
    title: '6. Termination',
    body: [
      'We may suspend or terminate your access to the service, without prior notice, if you violate these Terms of Service or if required by law. You may stop using the service and delete your account at any time.',
    ],
  },
  {
    title: '7. Disclaimer of Warranties',
    body: [
      'The service is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.',
      'While we strive for accuracy, generated timetables should be independently verified before publication.',
    ],
  },
  {
    title: '8. Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, Smart Timetable shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill arising out of or related to your use of the service.',
    ],
  },
  {
    title: '9. Changes to These Terms',
    body: [
      'We may update these Terms of Service from time to time. Changes will be reflected on this page with an updated effective date. Your continued use of the service after changes constitutes acceptance of the revised terms.',
    ],
  },
  {
    title: '10. Contact Us',
    body: [
      'If you have any questions about these Terms of Service, please contact us at support@smarttimetable.app.',
    ],
  },
];

export default function Terms() {
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
            <h1>Terms of Service</h1>
            <p>Smart Timetable - Terms and conditions for using our platform.</p>
          </div>

          <div className="legal-hero">
            <div className="legal-hero-icon">
              <FiFileText size={22} />
            </div>
            <div>
              <h2>Terms of Service</h2>
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
