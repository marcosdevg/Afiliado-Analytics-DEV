// components/account/ChangePasswordClient.tsx
'use client'

import { useState } from 'react'
import ChangePasswordModal from './ChangePasswordModal'

export default function ChangePasswordClient() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Alterar
      </button>
      {open && <ChangePasswordModal onClose={() => setOpen(false)} />}
    </>
  )
}
