import PolicyPage from '@/components/PolicyPage';

export default function Refund() {
  return (
    <PolicyPage
      label="Legal"
      title="Refund & Cancellation Policy"
      sections={[
        {
          heading: 'Made-to-order products',
          body: [
            'Every piece is handmade and made to order. Once work has begun on your order, we are unable to offer a refund or cancellation.',
          ],
        },
        {
          heading: 'Cancellations',
          body: [
            'You may cancel your order before work begins. Please contact us as soon as possible on WhatsApp if you need to cancel.',
            'If your order has already been shipped, it cannot be cancelled but may be eligible for return under the conditions below.',
          ],
        },
        {
          heading: 'Damaged or defective items',
          body: [
            'If your order arrives damaged, please contact us within 48 hours of delivery with a photo of the item and packaging. We will arrange a replacement or repair at no cost to you.',
          ],
        },
        {
          heading: 'Returns',
          body: [
            'Due to the handmade and personalised nature of our products, we do not accept returns for change of mind.',
            'If there is a genuine issue with your order, please reach out and we will do our best to make it right.',
          ],
        },
        {
          heading: 'Refund process',
          body: [
            'Approved refunds are processed back through the original payment method within 7–10 business days.',
          ],
        },
      ]}
    />
  );
}
