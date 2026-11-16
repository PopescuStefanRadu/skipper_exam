// Maps the Google account's claims to the identity's traits. Only verified
// emails are accepted, so nobody can claim someone else's address.
local claims = std.extVar('claims');

if std.objectHas(claims, 'email_verified') && claims.email_verified then
  { identity: { traits: { email: claims.email } } }
else
  error 'the Google account has no verified email'
