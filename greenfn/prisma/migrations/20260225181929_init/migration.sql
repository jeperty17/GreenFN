-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "emaill" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_emaill_key" ON "User"("emaill");
