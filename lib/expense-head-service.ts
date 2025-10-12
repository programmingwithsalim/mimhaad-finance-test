// Re-export expense head functions from expense database service
export {
  getExpenseHeads as getAllExpenseHeads,
  createExpenseHead,
  getExpenseHeadById,
  updateExpenseHead,
  deleteExpenseHead,
} from "./expense-database-service";
