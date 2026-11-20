# frozen_string_literal: true

require "rails_helper"

RSpec.describe WorkLineHours do
  describe ".parse_minutes" do
    it "reads minutes and hours the way staff type them" do
      expect(described_class.parse_minutes("45")).to eq(45)
      expect(described_class.parse_minutes("45m")).to eq(45)
      expect(described_class.parse_minutes("45 min")).to eq(45)
      expect(described_class.parse_minutes("1.5h")).to eq(90)
      expect(described_class.parse_minutes("1h 30m")).to eq(90)
      expect(described_class.parse_minutes("1:30")).to eq(90)
      expect(described_class.parse_minutes("1.5", default_unit: :hours)).to eq(90)
    end

    it "rejects text that is not a duration" do
      expect { described_class.parse_minutes("abc") }.to raise_error(WorkLineHours::Error, /not a duration/)
      expect { described_class.parse_minutes("h") }.to raise_error(WorkLineHours::Error)
    end
  end

  describe ".distribute" do
    it "splits an hour of three 20-minute lines so the parts add up exactly" do
      parts = described_class.distribute(BigDecimal("1.00"), [ 20, 20, 20 ])
      expect(parts.map(&:to_f)).to eq([ 0.33, 0.34, 0.33 ])
      expect(parts.sum).to eq(BigDecimal("1.00"))
    end

    it "scales lines to a clock total within the tolerance" do
      parts = described_class.distribute(BigDecimal("0.99"), [ 30, 30 ])
      expect(parts.sum).to eq(BigDecimal("0.99"))
    end

    it "rejects lines that are clearly over or short" do
      expect { described_class.distribute(BigDecimal("1.00"), [ 30, 20 ]) }
        .to raise_error(WorkLineHours::Error, /short of this entry's 1h by 10m/)
      expect { described_class.distribute(BigDecimal("1.00"), [ 60, 20 ]) }
        .to raise_error(WorkLineHours::Error, /over this entry's 1h by 20m/)
    end
  end
end
