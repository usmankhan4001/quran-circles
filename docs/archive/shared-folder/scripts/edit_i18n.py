import json,re,sys
base=sys.argv[1]
EN={
'legal.contact.body':'Write to us at {email}. Please say which email address you use in the app. Never send a sign-in code or a password.',
'store.feature.join.body':'Sign in with a code sent to your email and pledge to come. We confirm, remind you before each session, and tell you if anything changes.',
'privacy.collect.phone':'Your WhatsApp number, which you give when you create your account. We use it for confirmations and reminders, and your circle’s coordinator can use it to contact you. We do not check it with a code.',
'privacy.sees.sms':'Resend, our email provider, which delivers sign-in codes and other emails and so sees your email address and the message.',
'privacy.messages.body':'We email you a one-time code each time you sign in. We use WhatsApp only for confirmations, important changes and, where push does not reach you, reminders. We check that you agreed first, and we send no advertising. You can switch reminders and the ayah of the day off in your profile at any time.',
'deleteAccount.app.step1':'Open Quran Circles and sign in with your email address. We email you a 6-digit code.',
'deleteAccount.web.step2':'Sign in with the email address of your account. We email you a code.',
'deleteAccount.request.body':'Email us from the address on your account and ask us to delete it. If you no longer have that address, give the WhatsApp number on the account instead. Before we delete anything we send a code to the email address on the account, to make sure the request is from you. We aim to finish within 30 days.',
'support.faq.code.a':'The code is sent by email. Check that you typed your email address correctly, and look in your spam or junk folder. Wait a few minutes before asking for another code; too many requests are paused for a while.',
'terms.account.body':'Your account belongs to your email address. Keep your email safe and do not share your sign-in codes. Give your real name when you join a circle, so its coordinator knows who to expect.',
'deleteAccount.deleted.profile':'Your email address, WhatsApp number, name, area and profile details.',
'deleteAccount.deleted.codes':'Sign-in codes and invitations for your email address and number, and any record from the 2026 Ramadan Dora (the earlier version of the site) that holds your name and number.',
}
NEWEN='Your email address. You sign in with it. We email a one-time code to it each time, to check that the address is yours.'
UR={
'legal.contact.body':'ہمیں {email} پر لکھیں۔ براہ کرم بتائیں کہ آپ ایپ میں کون سا ای میل پتا استعمال کرتے ہیں۔ سائن اِن کوڈ یا پاس ورڈ کبھی نہ بھیجیں۔',
'store.feature.join.body':'ای میل پر آنے والے کوڈ سے سائن اِن کریں اور آنے کا وعدہ کریں۔ ہم تصدیق کرتے ہیں، ہر نشست سے پہلے یاد دلاتے ہیں اور کوئی تبدیلی ہو تو بتاتے ہیں۔',
'privacy.collect.phone':'آپ کا واٹس ایپ نمبر، جو آپ اکاؤنٹ بناتے وقت دیتے ہیں۔ ہم اسے تصدیق اور یاددہانیوں کے لیے استعمال کرتے ہیں، اور آپ کے حلقے کا کوآرڈینیٹر آپ سے رابطے کے لیے استعمال کر سکتا ہے۔ ہم کوڈ سے اس کی تصدیق نہیں کرتے۔',
'privacy.sees.sms':'ریسینڈ (Resend)، ہمارا ای میل فراہم کنندہ، جو سائن اِن کوڈ اور دوسری ای میلز پہنچاتا ہے اور اس لیے آپ کا ای میل پتا اور پیغام دیکھتا ہے۔',
'privacy.messages.body':'ہر بار سائن اِن کرتے وقت ہم آپ کو ایک بار استعمال ہونے والا کوڈ ای میل کرتے ہیں۔ ہم واٹس ایپ صرف تصدیق، اہم تبدیلیوں اور، جہاں پش نہ پہنچے، یاددہانیوں کے لیے استعمال کرتے ہیں۔ ہم پہلے دیکھتے ہیں کہ آپ نے اجازت دی ہے، اور ہم اشتہار نہیں بھیجتے۔ آپ اپنی پروفائل میں کسی بھی وقت یاددہانیاں اور آج کی آیت بند کر سکتے ہیں۔',
'deleteAccount.app.step1':'قرآن سرکلز کھولیں اور اپنے ای میل پتے سے سائن اِن کریں۔ ہم آپ کو 6 ہندسوں کا کوڈ ای میل کرتے ہیں۔',
'deleteAccount.web.step2':'اپنے اکاؤنٹ کے ای میل پتے سے سائن اِن کریں۔ ہم آپ کو کوڈ ای میل کرتے ہیں۔',
'deleteAccount.request.body':'اپنے اکاؤنٹ والے پتے سے ہمیں ای میل کر کے اکاؤنٹ حذف کرنے کو کہیں۔ اگر وہ پتا اب آپ کے پاس نہیں تو اکاؤنٹ کا واٹس ایپ نمبر بتائیں۔ کچھ بھی حذف کرنے سے پہلے ہم اکاؤنٹ کے ای میل پتے پر کوڈ بھیجتے ہیں تاکہ یقین ہو کہ درخواست آپ ہی کی ہے۔ ہم 30 دن کے اندر کام مکمل کرنے کی کوشش کرتے ہیں۔',
'support.faq.code.a':'کوڈ ای میل پر بھیجا جاتا ہے۔ دیکھیں کہ آپ نے اپنا ای میل پتا درست لکھا ہے، اور اسپیم یا جنک فولڈر بھی دیکھیں۔ دوسرا کوڈ مانگنے سے پہلے چند منٹ انتظار کریں؛ بہت زیادہ درخواستیں کچھ دیر کے لیے روک دی جاتی ہیں۔',
'terms.account.body':'آپ کا اکاؤنٹ آپ کے ای میل پتے سے جڑا ہے۔ اپنی ای میل محفوظ رکھیں اور اپنے سائن اِن کوڈ کسی کو نہ بتائیں۔ حلقے میں شامل ہوتے وقت اپنا اصل نام دیں تاکہ کوآرڈینیٹر کو معلوم ہو کہ کس کا انتظار کرنا ہے۔',
'deleteAccount.deleted.profile':'آپ کا ای میل پتا، واٹس ایپ نمبر، نام، علاقہ اور پروفائل کی تفصیلات۔',
'deleteAccount.deleted.codes':'آپ کے ای میل پتے اور نمبر کے سائن اِن کوڈ اور دعوت نامے، اور رمضان 2026 کے دورے (سائٹ کے پہلے ورژن) کا کوئی بھی ریکارڈ جس میں آپ کا نام اور نمبر ہو۔',
}
NEWUR='آپ کا ای میل پتا۔ آپ اسی سے سائن اِن کرتے ہیں۔ پتا آپ کا ہونے کی تصدیق کے لیے ہم ہر بار اس پر ایک بار استعمال ہونے والا کوڈ ای میل کرتے ہیں۔'
for lang,M,new in (('en',EN,NEWEN),('ur',UR,NEWUR)):
    path=f'{base}/packages/i18n/src/{lang}/user-app.json'
    lines=open(path,encoding='utf-8').read().split('\n')
    out=[];done=set()
    eol='\r' if lines[0].endswith('\r') else ''
    for ln in lines:
        m=re.match(r'^  "([^"]+)": ',ln)
        if m and m.group(1) in M:
            k=m.group(1); done.add(k)
            nk='privacy.sees.email' if k=='privacy.sees.sms' else k
            out.append(f'  {json.dumps(nk)}: {json.dumps(M[k],ensure_ascii=False)},'+eol)
            if k=='privacy.collect.phone':
                out.insert(len(out)-1,f'  "privacy.collect.email": {json.dumps(new,ensure_ascii=False)},'+eol)
        else: out.append(ln)
    assert done==set(M),set(M)-done
    open(path,'w',encoding='utf-8',newline='').write('\n'.join(out))
print('ok')
