# CAP V0.1 SMS Activation Plan

## Channel decision

The supplied records are U.S. businesses with U.S. phone numbers in E.164 format (`+1...`). CAP therefore uses **SMS as the first activation channel**, with **Twilio as the default U.S. provider**. Termii remains implemented as a provider adapter for future African-number campaigns; it is not the default for this Houston pilot.

Twilio's official Messaging API supports outbound message creation, status callbacks, and inbound messaging webhooks. U.S. application-to-person messaging also requires the applicable A2P 10DLC registration and carrier/compliance setup before production traffic. The implementation keeps provider credentials server-side and does not attempt to bypass provider registration or carrier restrictions.

## Message policy

The pilot opener is intentionally short and human:

> Hi, I came across [Business] in Houston and noticed an opportunity to improve your online visibility. We help local businesses get more leads with modern websites and booking systems. Would you be open to a quick conversation? — Osagie, Aureum Technologies

The message is prepared as a review artifact. It is not automatically sent. Follow-up, WhatsApp, proposal, and deal activity remain human-led after a positive response.

## Routing

| Number type | Provider route | Current status |
|---|---|---|
| U.S. `+1` number | Twilio SMS | Adapter implemented; credentials, sender, A2P registration, permission basis, and approval required |
| Non-U.S. number | Termii SMS | Adapter implemented; sender ID, account configuration, permission basis, and approval required |
| Invalid/unrecognized number | None | Blocked |

## Hard send gates

A record cannot be sent unless all of the following are true: the phone number is valid and routed; the record is not suppressed; the SMS opener is prepared; the operator has approved the SMS; a documented permission or compliance basis exists; no previous provider ID or sent timestamp exists; the provider gate is enabled; and the provider credentials/sender configuration are present.

The repository defaults `CAP_SMS_SEND_ENABLED=false`. No messages were sent during this activation work.

## End-to-end pilot sequence

The first controlled pilot should process five to ten records, not all 100. Review the normalized business identity and message, confirm the appropriate legal/compliance basis for contacting each number, approve the batch in CAP, verify the Twilio sender/A2P setup, send through the queue, and inspect delivery, opt-out, reply, and complaint signals. Stop immediately if delivery or complaint signals are abnormal.

A positive reply should move to human WhatsApp or email follow-up and then proposal/deal handling. CAP should not automate a WhatsApp conversation or claim a sale from an SMS delivery event.

## Provider references

- [Twilio Messaging API](https://www.twilio.com/docs/messaging/api)
- [Twilio Message resource](https://www.twilio.com/docs/messaging/api/message-resource)
- [Twilio messaging webhooks](https://www.twilio.com/docs/usage/webhooks/messaging-webhooks)
- [Twilio A2P 10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc)
- [Termii Messaging API](https://developers.termii.com/messaging-api)
