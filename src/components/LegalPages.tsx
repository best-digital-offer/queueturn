import React from 'react';

type LegalPageKey = 'about' | 'contact' | 'faq' | 'privacy' | 'terms' | 'refund';

const pageContent: Record<LegalPageKey, { title: string; intro: string; sections: { heading: string; body: string }[] }> = {
  about: {
    title: 'About QueueTurn',
    intro: 'QueueTurn helps businesses manage walk-in queues digitally, so customers can join a line, follow their position, and wait more comfortably without standing in a crowded queue.',
    sections: [
      { heading: 'What we do', body: 'We provide digital queue management tools for clinics, salons, repair shops, restaurants, and other service businesses. Features may include QR-based joining, live queue status, staff controls, and lobby display screens.' },
      { heading: 'Operated by', body: 'QueueTurn is operated by N&N Digitals.' },
      { heading: 'Our address', body: 'Sree Hemadurga Towers, 207, 2nd Floor, A Block, Alwin Cross, Hyderabad 500059, India.' }
    ]
  },
  contact: {
    title: 'Contact Us',
    intro: 'Questions about QueueTurn, your account, or a subscription? Contact our support team.',
    sections: [
      { heading: 'Email support', body: 'Email: support@queueturn.com. Please include your registered email address and a short description of the issue. Do not email passwords or payment card details.' },
      { heading: 'Business address', body: 'N&N Digitals, Sree Hemadurga Towers, 207, 2nd Floor, A Block, Alwin Cross, Hyderabad 500059, India.' },
      { heading: 'Support hours', body: 'We will respond as soon as reasonably possible. Response times may vary on weekends and public holidays.' }
    ]
  },
  faq: {
    title: 'Frequently Asked Questions',
    intro: 'Quick answers about using QueueTurn.',
    sections: [
      { heading: 'Do customers need to install an app?', body: 'No. Customers can open the public queue page from a QR code or link using a compatible browser.' },
      { heading: 'Can staff manage queues from a dashboard?', body: 'Yes. Signed-in business users can manage queues from the QueueTurn dashboard, subject to the features available on their plan.' },
      { heading: 'Can I show the queue on a TV?', body: 'QueueTurn supports a public display view for showing queue information on a suitable screen.' },
      { heading: 'How do subscriptions work?', body: 'Paid plan availability and limits will be shown on the pricing page. Checkout and subscription activation are only effective once payment integration is enabled.' },
      { heading: 'How can I get help?', body: 'Email support@queueturn.com.' }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'Effective October 10, 2026. This Privacy Policy explains how N&N Digitals processes personal information when you use QueueTurn.',
    sections: [
      { heading: 'Information we process', body: 'Depending on how you use QueueTurn, information may include account and business details, queue configuration, and visitor details entered by a business or visitor, such as name or phone number.' },
      { heading: 'How information is used', body: 'Information is used to provide queue management, display queue status, support accounts, maintain security, and troubleshoot the service.' },
      { heading: 'Service providers and security', body: 'QueueTurn uses hosting, database, authentication, and other service providers to operate the application. Access controls are used where configured, but no online service can guarantee absolute security.' },
      { heading: 'Retention and requests', body: 'Information is retained as needed for service operation, legal obligations, and legitimate business needs. For privacy questions or requests, contact support@queueturn.com.' },
      { heading: 'Children and sensitive information', body: 'Do not enter unnecessary sensitive personal information into queue fields. Businesses are responsible for providing appropriate notices to their visitors and collecting information lawfully.' }
    ]
  },
  terms: {
    title: 'Terms of Service',
    intro: 'Effective October 10, 2026. These Terms of Service govern your access to and use of QueueTurn, operated by N&N Digitals.',
    sections: [
      { heading: 'Using the service', body: 'You are responsible for maintaining the security of your account, ensuring the information you enter is accurate, and using QueueTurn in compliance with applicable laws.' },
      { heading: 'Queue and visitor data', body: 'Businesses are responsible for the visitor information they collect and for informing visitors how that information is used.' },
      { heading: 'Plans and billing', body: 'Plan features, prices, billing intervals, and applicable taxes are shown on the public pricing page and in checkout before payment. Paddle processes subscription payments as our payment provider. A subscription is activated after payment confirmation.' },
      { heading: 'Availability and changes', body: 'We may update or improve the service. We will make reasonable efforts to keep the service available, but uninterrupted availability is not guaranteed.' },
      { heading: 'Contact', body: 'For questions about these terms, email support@queueturn.com.' }
    ]
  },
  refund: {
    title: 'Refund & Cancellation Policy',
    intro: 'Effective October 10, 2026. This Refund & Cancellation Policy explains how QueueTurn subscription cancellations and refund requests are handled.',
    sections: [
      { heading: 'Cancellation', body: 'You can request cancellation through the subscription management options available in your account or by emailing support@queueturn.com. Cancellation stops future renewals; access generally continues until the end of the current paid billing period unless the checkout terms or applicable law require otherwise.' },
      { heading: 'Refund requests', body: 'Subscription fees are generally non-refundable for partially used billing periods, except where required by law or stated otherwise at checkout. If you believe you were charged incorrectly, charged twice, or cannot access a paid subscription, email support@queueturn.com within 14 days with your account email, transaction reference, date, and reason. Do not send full payment card details. We review requests individually and process approved refunds through the original payment provider.' },
      { heading: 'Duplicate or incorrect charges', body: 'Confirmed duplicate or incorrect charges will be reviewed promptly and, where appropriate, refunded through the original payment provider.' },
      { heading: 'Statutory rights and taxes', body: 'Nothing in this policy limits consumer rights that cannot legally be excluded. Any applicable taxes and refund treatment are subject to the terms shown at checkout and applicable law.' },
      { heading: 'Support', body: 'Email support@queueturn.com.' }
    ]
  }
};

export const LegalPages: React.FC<{ page: string }> = ({ page }) => {
  const key = (page in pageContent ? page : 'about') as LegalPageKey;
  const content = pageContent[key];
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-800">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <a href="/" className="text-sm font-bold text-indigo-600 hover:text-indigo-800">← Back to QueueTurn</a>
        <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-600">QueueTurn · N&N Digitals</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{content.title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{content.intro}</p>
        <div className="mt-8 space-y-7">
          {content.sections.map(section => <section key={section.heading}>
            <h2 className="text-base font-extrabold text-slate-900">{section.heading}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{section.body}</p>
          </section>)}
        </div>
        <div className="mt-10 border-t border-slate-100 pt-5 text-xs leading-6 text-slate-500">
          <p><a className="font-semibold text-indigo-600" href="mailto:support@queueturn.com">support@queueturn.com</a></p>
          <p>N&N Digitals, Sree Hemadurga Towers, 207, 2nd Floor, A Block, Alwin Cross, Hyderabad 500059, India.</p>
          <p className="mt-3">© 2026 N&N Digitals. All rights reserved.</p>
        </div>
      </article>
    </main>
  );
};
