class AddUploadSourceToDocuments < ActiveRecord::Migration[8.1]
  def change
    add_column :documents, :upload_source, :string
    add_index :documents, :upload_source
  end
end
