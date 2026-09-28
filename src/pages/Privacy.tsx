import PolicyPage from '@/components/PolicyPage';

export default function Privacy() {
  return (
    <PolicyPage
      label="Legal"
      title="Privacy Policy"
      sections={[
        {
          heading: 'Information we collect',
          body: [
            'When you place an enquiry or order with us, we collect your name, contact details, and delivery address — only what is needed to fulfil your order.',
            'If you message us on WhatsApp, we receive whatever information you choose to share through that conversation.',
          ],
        },
        {
          heading: 'How we use your information',
          body: [
            'We use your information solely to process orders, arrange delivery, and respond to your enquiries.',
            'We do not sell, rent, or share your personal information with any third party for marketing purposes.',
          ],
        },
        {
          heading: 'Data storage',
          body: [
            'Order details are kept for our records and to assist with any future enquiries or returns. We do not store payment information — all transactions are handled externally via WhatsApp or other agreed methods.',
          ],
        },
        {
          heading: 'Your rights',
          body: [
            'You may request access to or deletion of your personal information at any time by contacting us through WhatsApp or our Contact page.',
          ],
        },
        {
          heading: 'Cookies',
          body: [
            'Our website does not use tracking cookies. We may use essential functionality to remember items in your enquiry cart during your visit.',
          ],
        },
      ]}
    />
  );
}
