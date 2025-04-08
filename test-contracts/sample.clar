;; Define the contract's data variables

;; Maps a user's principal address to their deposited amount.
(define-map deposits { owner: principal } { amount: uint })

;; Holds the total amount of deposits in the contract, initialized to 0.
(define-data-var total-deposits uint u0)

;; Public function for users to deposit STX into the contract.

;; Updates their balance and the total deposits in the contract.
(define-public (deposit (amount uint))
   (let (
   ;; Fetch the current balance or default to 0 if none exists.
   (current-balance (default-to u0 (get amount (map-get? deposits { owner: tx-sender })))))
   ;; Transfer the STX from sender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" to recipient = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.stx-defi (ie: contract identifier on the chain!)".
   (try! (stx-transfer? amount tx-sender (as-contract tx-sender))) ;; Modified line
   ;; Update the user's deposit amount in the map.
   (map-set deposits { owner: tx-sender } { amount: (+ current-balance amount) })
   ;; Update the total deposits variable.
   (var-set total-deposits (+ (var-get total-deposits) amount))
   ;; Return success.
   (ok true)
   )
)

;; Read-only function to get the total balance
(define-read-only (get-balance) ;; Modified function
   (ok (var-get total-deposits))
)
