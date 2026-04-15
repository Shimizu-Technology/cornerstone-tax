class AddOtherIncomeAndComments < ActiveRecord::Migration[8.1]
  def change
    add_column :clients, :other_income, :text
    add_column :clients, :comments, :text
  end
end
