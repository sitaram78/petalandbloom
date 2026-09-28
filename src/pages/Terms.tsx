import PolicyPage from '@/components/PolicyPage';

export default function Terms() {
  return (
    <PolicyPage
      label="Legal"
      title="Terms of Service"
      sections={[
        {
          heading: 'Our products',
          body: [
            'All products are handmade and made to order. Slight variations in colour, size, and finish are natural characteristics of handmade items and not defects.',
            'Product images are representative — actual colours may vary slightly depending on yarn availability and screen settings.',
          ],
        },
        {
          heading: 'Pricing',
          body: [
            'All prices are listed in Indian Rupees (₹) and are inclusive of applicable taxes unless stated otherwise.',
            'Prices may change without notice. The price at the time of order confirmation is the price that applies.',
          ],
        },
        {
          heading: 'Orders',
          body: [
            'Placing an enquiry or order through our website or WhatsApp does not guarantee availability. We confirm each order personally before proceeding.',
            'Custom orders require a detailed discussion before work begins. Once work has started, changes may not be possible.',
          ],
        },
        {
          heading: 'Intellectual property',
          body: [
            'All product designs, photographs, and content on this website are the property of The Petal & Bloom and may not be reproduced without permission.',
          ],
        },
        {
          heading: 'Contact',
          body: [
            'For any questions about these terms, please reach out to us on WhatsApp or through our Contact page.',
          ],
        },
      ]}
    />
  );
}
