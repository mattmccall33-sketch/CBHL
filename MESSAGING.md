# Messaging players

How to send league updates (rain-outs, schedule changes, announcements) to players through the **TheCBHL** WhatsApp group and by email, using the **Message players** panel on the site's edit screen.

Messages are sent from **your own** WhatsApp and email. The website never stores or sends anything itself.

---

## Before you start

| You need | Why |
|---|---|
| The site open with `#admin` on the end of the address | That's what shows the **Edit** button |
| WhatsApp on your phone, and you're a member of **TheCBHL** | WhatsApp messages post to the group |
| Your contacts file (`cbhl-contacts.csv`) on your computer or phone | Email addresses for the email list |
| An email app (Gmail, Outlook, Apple Mail, etc.) set up on the device | The **Email everyone** button opens it |

> **Tip:** For WhatsApp, use your phone. It opens the WhatsApp app directly. For email, either device works.

---

## Open the Message players panel

1. Go to your site's homepage with `#admin` at the end, for example:
   `https://www.thecbhl.com/#admin`
2. Click **Edit** in the dark menu bar. If you don't see it, refresh the page.
3. **Message players** is the first section below the yellow "Editing league data" box.
4. Fill in:
   - **Email subject**, which is used for email only. It starts as "CBHL update".
   - **Message**, the text that goes out on both WhatsApp and email.

Nothing in this panel changes the website. You don't need to download or upload anything after sending a message.

---

## Send to the WhatsApp group

1. Type your message.
2. Tap **Open in WhatsApp**.
3. WhatsApp opens with your message already typed and asks who to send it to.
4. Choose **TheCBHL**. Use the search box at the top if it isn't near the top of the list.
5. Check the message, then tap **Send**.

**Other options**
- **Copy message** copies the text so you can paste it anywhere, such as a different group or a Facebook post.
- On a computer, the button opens WhatsApp Desktop or WhatsApp Web if you have them set up. Otherwise, use your phone.

---

## Send an email

### 1. Load your contacts file
1. Under **Email**, click **Choose File** next to *Contacts file*.
2. Pick `cbhl-contacts.csv`.
3. The panel shows how many addresses it found, for example "**42 email addresses** loaded from cbhl-contacts.csv."

You need to load the file each time you open the edit screen. It isn't saved anywhere.

### 2. Send
1. Click **Email everyone (42)**.
2. Your email app opens a new message with:
   - everyone in **BCC**, so players can't see each other's addresses
   - your subject and message filled in
3. Check it, then click **Send**.

**If the list is long:** some email apps can't handle very long address lists, so the panel may split them into **Email group 1 of 2**, **Email group 2 of 2**, and so on. Click each button and send each email.

**Other option:** **Copy all addresses** copies every address, separated by commas. Paste them into the **BCC** field of a new email yourself. This is handy for Gmail in a browser.

---

## The contacts file

`cbhl-contacts.csv` holds players' email addresses.

> ⚠️ **Never upload the contacts file to GitHub.** This repository and website are public. Anyone could download it. Keep it on your computer, in a private cloud folder like Google Drive or OneDrive, or both.

**Format.** Open it in Excel, Google Sheets or Numbers. Keep it simple:

```
name,email
Patrick McCall,patrick@example.com
Troy Coleman,troy@example.com
```

- One player per row.
- Extra columns, such as team or phone, are fine. The page only picks out the email addresses.
- Duplicate addresses are removed automatically.
- When saving from Excel, choose **CSV (Comma delimited) (*.csv)**.

**Adding or removing a player:** edit the file, save it, and load it again on the edit screen.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No **Edit** button | Make sure the address ends in `#admin`, then refresh the page. |
| **Open in WhatsApp** opens a web page instead of the app | Use your phone, or install WhatsApp Desktop on your computer. |
| TheCBHL isn't in the list when sharing | Search for "TheCBHL" in the share screen. You must be a member of the group. |
| "No email addresses found" | The file may not be saved as CSV, or the email column is empty. Re-save as CSV and load it again. |
| **Email everyone** does nothing | Your device has no default email app. Use **Copy all addresses** and paste them into BCC in Gmail or Outlook. |
| Some people didn't get the email | Check their address in the contacts file and ask them to check spam. Gmail may flag large BCC emails; sending in smaller groups helps. |
| Message text looks cut off in email | Very long messages can be trimmed by some email apps. Use **Copy message** and paste it into the email instead. |

---

## WhatsApp group admin notes

- **Invite link:** The public WhatsApp page (`whatsapp.html`) has a **Join TheCBHL** button using the group's invite link. If you reset the link in WhatsApp (*group info → Invite via link → Reset link*), the old one stops working. Update the link in `whatsapp.html` (it appears twice) and upload the file again.
- **Approve new members:** Because the invite link is public, consider turning on *group info → Group settings → Approve new members* so you approve each person who asks to join.
- **Announcements only:** If you want only admins to post, set *Group settings → Send messages → Only admins*.
- WhatsApp's menu names change from time to time. If a setting isn't where this says, check [faq.whatsapp.com](https://faq.whatsapp.com/).
