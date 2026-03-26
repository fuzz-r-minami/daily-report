import keytar from 'keytar'

const SERVICE_NAME = 'daily-report'

export async function setCredential(key: string, value: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, value)
}

export async function getCredential(key: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, key)
}

export async function deleteCredential(key: string): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, key)
}
